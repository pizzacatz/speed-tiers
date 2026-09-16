# Architecture

Vanilla HTML/CSS/JS, no framework, no build step for the app itself. `build.py` injects the committed MCP data, state module, and engine into
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
  v: 2, name, catalogue: [entityId], dataRevision, guideDismissed,
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
- `StateModel.normalize` validates and reconstructs imported/stored state. It rejects invalid IDs, colors, ranges, types, collection sizes, and duplicate IDs before they reach rendering. Unknown entities and obsolete target references are removed; column visibility/sort are repaired.
- Version 1 migrates using the original roster catalogue. Version 2 saves its known catalogue, so future roster additions are added once without resurrecting deliberately removed old rows.
- Named setups live under `speedtiers.setups.v1`. The last replaced setup is backed up under `speedtiers.v1.previous`; unreadable startup state is retained under `.recovery`. Storage failures are reported, and exports remain usable.
- `StateModel.pack` uses compact row tuples; `ShareCodec` gzip-compresses UTF-8 JSON into a URL-safe fragment. Both compressed input and decompressed output are bounded. Opening links and importing JSON validates and previews before applying, then backs up the current state.

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
- Hover comparisons reserve three lines per anchor (four on narrow screens), with internal scrolling for longer results. Cards cannot flex-shrink and the dock reserves its scrollbar gutter, so comparison content never changes header geometry. Pointer/focus changes select a row; leaving the table or crossing a header keeps the last comparison readable.
- Anchor cards are rendered by `renderDock()`; live edits (`input` in a card) update that card's number, `renderTable()`, `renderStatuses()` (target lines) and `renderSolve()` (hover lines) without rebuilding the controls, so the SP slider keeps focus. Cards are HTML5-draggable (dragstart is suppressed when it originates on an input/select/button so range sliders still work).
- `#top` is sticky on desktop and static on narrow screens. `.tableRegion` provides a bounded horizontal/vertical scrolling area with sticky column headers at its top. Row action buttons stay visible at the right edge.
- Interactive names, cells, tags, and column controls are native buttons. Dialogs use native `<dialog>.showModal()` for focus containment. Commit restores focus after rendering, and dialogs restore their opener after closing. Anchor up/down and column left/right buttons supplement dragging.
- Column widths: table is `width:auto; table-layout:auto` with `white-space:nowrap`, so every column is content-fit by default. Each `th` carries a `.rz` drag handle (mousedown/mousemove/mouseup on `document`); the resulting px width is stored in `S.colWidths[key]` and applied as `width/min-width/max-width` on the `th` (name/tags cells additionally clip with an ellipsis when narrowed). Double-click a handle to delete the entry and auto-fit again.
- All interactions are event-delegated on `#tbl`, `#dock`, `#colChips`, `#tagFilters`; modals are rendered into `#modalHost`.

## Extension points

- **New speed modifier** (item/ability): add to `Engine.ITEMS`/`ITEM_LABEL` or to the MCP snapshot importer (after verifying with the MCP)
  (mult + optional field condition) — the UI selects derive from those tables.
- **New field condition**: add to `field`, to `condMet()` in the engine, and a toggle in the header.
- **New preset column / tag**: edit `defaultColumns()` / `defaultTags()` in `src/app.html` (only affects fresh states — existing users keep theirs).
- **Schema change**: bump `v`, migrate in `StateModel.normalize()`, and add round-trip and migration checks.

## Validation

`npm test` runs original engine vectors, fresh MCP fixtures in `test/mcp-vectors.json`, migration and hostile-input checks, bounded share-codec round trips, and jsdom integration tests. jsdom verifies interaction wiring, not physical browser layout or native dialog focus trapping. GitHub Pages builds and runs these checks before deploying the committed standalone HTML.

## Focused Compare workspace (redesign branch)

`src/compare.js` and `src/compare.css` are inlined into the existing standalone app by `build.py`.
`S.compare` holds `{view, search, preset, mine:{ent,spec}, opponent:{ent,spec}}`; omitted state in old
exports receives `StateModel.defaultCompare`. Both sets use `Engine.compute` and `Engine.solve`,
with side A for mine and B for opponent. Field settings are shared with Full tiers, while each
workspace retains its own sets and rows. Roster selection uses native buttons and updates the
inspector without replacing the roster or moving keyboard focus. Hover has no state-changing handler.
