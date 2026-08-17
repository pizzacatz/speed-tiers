# Architecture

Vanilla HTML/CSS/JS, no framework, no build step for the app itself. `build.py` only injects data and the engine into
`src/app.html`. Everything below is inside the one output file.

## Layers inside `speed-tiers.html`

1. `<style>` — CSS custom properties for light/dark (three states: explicit `data-theme`, or `prefers-color-scheme`).
2. `<script type="application/json" id="data">` — the generated data blob (see `DATA.md`).
3. `<script>` engine — `src/engine.js`, pure functions, no DOM.
4. `<script>` app — state, resolution, render, modals, events (all in one IIFE).

## Engine (`src/engine.js`)

```
DEFAULT_SPEC = { sp:0, align:0, stage:0, item:'none', abil:'auto', tailwind:false, para:false, priority:0, side:null }
merge(...layers)                    → full spec; later layers win; null/undefined = "not set"
compute(entity, spec, field, AB)    → { speed, steps[], priority, ability }   (steps = per-stage breakdown)
comparator(trickRoom)               → sort fn: priority desc, then speed desc (asc under Trick Room)
relation(a, b, trickRoom)           → 'faster' | 'tie' | 'slower' (a vs b, honoring priority + TR)
solve(entity, spec, field, AB, target, trickRoom) → list of minimal tweaks that beat `target`
```
`abil` modes: `auto` (fire only when the field satisfies the ability's condition, e.g. rain for Swift Swim), `on`, `off`.
`side` + `field.tailwind[side]` gives per-side Tailwind; `spec.tailwind` forces it.

The engine is CommonJS-exported when `module` exists so `test/engine.test.js` can run it under node.

## State (single JSON object, persisted to `localStorage['speedtiers.v1']`)

```
{
  v: 1,
  field:   { weather:null|'sun'|'rain'|'sand'|'snow', eterrain, trickRoom, tailwind:{A,B} },
  global:  PartialSpec,
  columns: [{ id, label, spec: PartialSpec, visible }],   sortCol: id,
  tags:    [{ id, name, color, defaults: PartialSpec }],
  rows:    [{ id, ent: entityId, tags:[tagId], ov: PartialSpec }],
  anchors: [{ id, rowId, spec: FullSpec, color, collapsed }],   // ordered = card order in the dock
  targets: [{ id, ent, rowId, colId, label, spec: FullSpec }],   // rowId/colId only locate the 🎯 cell
  filters: { tags:[], mode:'any'|'all', search, onlyTagged, megas },
  theme:   'auto'|'dark'|'light',
  colWidths: { [columnId|'name'|'tags'|'vs']: px }   // absent = content-fit
}
```
- Rows reference entities by id, so the same species can appear several times (Duplicate row) with different tags/overrides.
- Anchors reference a row and hold their own **full** spec (initialised from the row resolved at the sort column), so
  editing the anchor never mutates the row. Each anchor has a stable color from `ANCHOR_COLORS`.
- Targets are **snapshots** made by `makeTarget(row, col)`: the cell's resolved spec with the field folded in
  (`abil` → `'on'`/`'off'` depending on whether the ability was active, `tailwind` → true/false, `side` → null), so their
  speed is independent of the field bar afterwards. `targetCalc(t)` recomputes from the stored spec.
- On load, rows/anchors pointing at entities no longer in the data are dropped (survives roster changes between builds).

## Resolution pipeline

```
cell(row, column) = compute(entity, merge(global, column.spec, ...row.tags.map(t => t.defaults), row.ov), field)
sortKey(row)      = cell(row, sortColumn)
anchorSpeed(a)    = compute(entity(a.row), merge(a.spec), field)              — one 'vs' column + divider per anchor
badge(row, a)     = relation(sortKey(row), anchorSpeed(a), trickRoom)
status(a, t)      = relation(anchorSpeed(a), targetCalc(t)) + Engine.solve(...) → minimal fix to beat t by ≥1
```
`overriddenKeys(row, col)` reports which of the column's own preset keys were changed by a tag/override; the cell shows a ● and lists them in its tooltip.

## Rendering

- `render()` = header + toolbar + table + dock, rebuilt from state on every `commit()` (`save()` is debounced 150 ms).
- Table is one `innerHTML` string per render (≈300 rows × ≤8 columns → a few ms). Rows are banded by distinct
  (priority, speed) so speed ties are visible; the anchor divider row is inserted where the anchor sorts.
- Anchor cards are rendered by `renderDock()`; live edits (`input` in a card) update that card's number, `renderTable()`, `renderStatuses()` (target lines) and `renderSolve()` (hover lines) without rebuilding the controls, so the SP slider keeps focus. Cards are HTML5-draggable (dragstart is suppressed when it originates on an input/select/button so range sliders still work).
- `#top` (header + anchor dock + toolbar) is one sticky block; a `ResizeObserver` writes its height to `--topH`, which the sticky `thead` uses as its `top` offset. `main` must not be an overflow container or the sticky header would attach to it instead of the viewport.
- Column widths: table is `width:auto; table-layout:auto` with `white-space:nowrap`, so every column is content-fit by default. Each `th` carries a `.rz` drag handle (mousedown/mousemove/mouseup on `document`); the resulting px width is stored in `S.colWidths[key]` and applied as `width/min-width/max-width` on the `th` (name/tags cells additionally clip with an ellipsis when narrowed). Double-click a handle to delete the entry and auto-fit again.
- All interactions are event-delegated on `#tbl`, `#dock`, `#colChips`, `#tagFilters`; modals are rendered into `#modalHost`.

## Extension points

- **New speed modifier** (item/ability): add to `Engine.ITEMS`/`ITEM_LABEL` or to `SPEED_ABILITIES` in `build.py`
  (mult + optional field condition) — the UI selects derive from those tables.
- **New field condition**: add to `field`, to `condMet()` in the engine, and a toggle in the header.
- **New preset column / tag**: edit `defaultColumns()` / `defaultTags()` in `src/app.html` (only affects fresh states — existing users keep theirs).
- **Schema change**: bump `v`, migrate in `load()`.
