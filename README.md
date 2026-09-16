# Champions Speed Tiers

A single-file, fully offline speed-tier calculator for **Pokémon Champions (Regulation M-C)**.

**Use it online:** [Champions Speed Tiers](https://pizzacatz.github.io/speed-tiers/).

**Use it offline:** download [`speed-tiers.html`](https://pizzacatz.github.io/speed-tiers/speed-tiers.html) and open it in any modern browser. No server, no network, no install.
Everything (roster data, sprites, engine, UI) is embedded in that one file (~1.1 MB).

[Layout overview](docs/layout.txt)

## What it does

| Area | Details |
|---|---|
| Roster | Every Regulation M-C legal species and Mega form, with base Speed, types, speed-relevant abilities and menu sprite. |
| Columns | Preset "what-if" specs shown side by side: **Min** (0 SP, −Spe), **Base** (0 SP, neutral — the in-game presented stat), **Max** (32 SP, +Spe), **Scarf**, **+1**, **−1**, **Tailwind**, **Scarf+TW**. Click a column to sort by it; hide, drag-reorder, edit, or add your own (e.g. *Max in Rain*). Columns default to content-fit width (nothing wraps or is clipped); drag a header's right edge to resize, double-click it to auto-fit. Widths are saved. |
| Tags | Arbitrary labels with optional defaults. Seeded: **My Team** (side A), **Opponent** (side B), **Watchlist**, **Trick Room** (0 SP, −Spe), **Scarfer** (Choice Scarf). Filter rows by tag (any/all). |
| Row overrides | Per-row facts (SP, alignment, stage, item, ability mode, Tailwind, paralysis, priority, side). Click a Pokémon's name to open the editor with a full step-by-step breakdown per column. |
| Field bar | Weather (☀/🌧/🏜/❄), Electric Terrain, Trick Room, Tailwind per side (A/B). Weather/terrain auto-activate Chlorophyll, Swift Swim, Sand Rush, Slush Rush and Surge Surfer for rows whose ability mode is *auto*. |
| Anchor dock | Pin any rows (◆). Every anchor gets its own **stacked card** under the header (drag ⋮⋮ to reorder, ▾ to collapse), its own colored **vs** column in the table (outspeeds / speed tie / slower ±N at the sort column), and a colored divider row marking where it sits. Edit each anchor's set live; hovering or focusing a row shows what each anchor needs to beat it in a reserved, scrollable area. The last comparison stays visible when you leave the table, without resizing the header. |
| Targets | Click any speed cell — e.g. *Swampert-Mega × Min* while Rain is on — to mark it 🎯 as a value to beat. The cell's ability/Tailwind state is snapshotted so the target does not move when the field bar changes (click the chip to relabel/edit). Every anchor card then shows ✓/✗ against every target plus the minimal change that beats it by at least 1 point: `SP ≥ n (speed)`, `+Spe alignment, SP ≥ n`, `Choice Scarf`, `Stage +n`, `Tailwind`. |
| Setups & sharing | Auto-saved to `localStorage`. **Setups** saves up to 20 named teams/comparisons. **Share link** captures the complete setup in a compressed URL fragment. Links and JSON imports show a preview before replacing the current comparison; **Restore previous** recovers the last replaced setup. **Export / Import** JSON provides portable backups. |
| Accessibility & guidance | First-use guide tracks pinning an anchor and choosing a target. Touch-friendly buttons, a scrollable table, native keyboard controls, focus-contained dialogs, and buttons for reordering anchors/columns. Dark / light / auto theme; `/` focuses search and `?` opens help. |

## The speed model (Champions ≠ mainline)

Level 50, perfect IVs, **Stat Points** (SP, 0–32 per stat, ≤66 total) instead of EVs, and **Stat Alignments** instead of Natures
(21 of them; exactly four raise Speed — Hasty, Jolly, Naive, Timid — and only Serious is neutral):

```
Speed = ⌊(Base + 20 + SP) × Alignment⌋        Alignment ∈ {×1.1, ×1.0, ×0.9}
then, flooring after each step:
  stage (+n → (2+n)/2, −n → 2/(2+n))  →  ability (×2 / ×1.5)  →  item (Scarf ×1.5, Iron Ball ×0.5)
  →  Tailwind ×2  →  paralysis ×0.5
Priority bracket first; Trick Room reverses order within a bracket.
```

Vectors are validated against the `champions-logic` MCP `speed_order` tool — see [`test/engine.test.js`](test/engine.test.js).

## Precedence of settings

`global defaults → column preset → tags (in the row's tag order) → row override`

Row facts (tags/overrides) win over column presets for the fields they set — e.g. a **Scarfer**-tagged Pokémon shows its scarfed
speed in every column. A purple ● on a cell (with a tooltip) tells you a tag/override changed that column's own preset.

## Repository layout

```
speed-tiers.html     ← the app (generated; commit it, it's the deliverable)
build.py             ← builds speed-tiers.html from the committed MCP snapshot
src/app.html         ← UI template (CSS + JS); /*__DATA__*/ and /*__ENGINE__*/ are injected
src/engine.js        ← pure speed engine, shared by the app and the tests
src/state.js         ← strict import validation, migration, and share-link encoding
data/roster.json     ← MCP-sourced offline roster, abilities, alignments, and sprites
scripts/import_mcp.py ← converts typed MCP responses and sprite assets into the snapshot
test/engine.test.js  ← node tests for the engine
docs/ARCHITECTURE.md ← state model, resolution pipeline, rendering, extension points
docs/DATA.md         ← what data is embedded, where it comes from, how to refresh it
```

## Rebuild

The normal build requires only Python 3. The current roster is committed, so rebuilding does not
need a database, network connection, or private repository. Node 22.22.2+ and dev dependencies
are used only for tests; the app itself has no runtime dependencies.

```bash
python3 build.py            # → speed-tiers.html, reproducibly
npm ci                     # install test dependencies
npm test                   # engine, MCP conformance, state, and UI interaction checks
```

To refresh the roster from the champions-logic MCP, see [data refresh instructions](docs/DATA.md).

The page footer shows the embedded data version/revision so you can tell which regulation snapshot a copy reflects.

## Data & credits

Species, Mega and ability data come from the `champions_logic` database (Regulation M-C).
Pokémon and sprites belong to their respective owners, including Nintendo, Game Freak, and The Pokémon Company.
This is an unofficial fan tool and is not affiliated with or endorsed by them.

## Publishing

GitHub Pages serves the committed `speed-tiers.html` at the site root and at `/speed-tiers.html`.
The [Pages workflow](.github/workflows/pages.yml) runs the engine tests and deploys on pushes to `master`,
or when manually dispatched from the Actions tab. It also rebuilds the app, verifies that the
committed HTML matches the source, and runs the state and UI tests. Pages must use **GitHub Actions** as its source.
After editing the app template or engine, run `python3 build.py` and commit the regenerated
`speed-tiers.html` before pushing. Deployment uses the committed app and needs no database access.

Saved setups are specific to the browser and origin. To move a setup from a downloaded copy to
the hosted app, use **Export** in the old copy and **Import** on the site.

## Accuracy and scope

The committed MCP snapshot is **M-C+2026-09-14**, revision **b69c0ab9992b61c7**: **264 species/formes
and 82 Mega forms**. Existing M-B setups migrate automatically, adding only newly introduced
entries and retaining row overrides, tags, anchors, and targets.

- Priority is checked before Speed, including in target suggestions and Trick Room.
- Quick Feet ignores paralysis's Speed penalty; auto activates it when paralysis is selected.
  For another status, select Quick Feet as active. Unburden is activated manually after item loss.
- Auto ability mode considers the entity's available Speed abilities. Select a specific active
  ability or **off** to model your actual set; this is not an ability-choice legality checker.
- Mega forms require their stone, so Scarf and Iron Ball modifiers/suggestions do not apply to
  them. Quick Powder is not legal in this snapshot and is removed from legacy setups with a notice.
- Stage-triggering abilities use the Stage control. Quick Claw, Stall, and similar ordering
  effects within a priority bracket are outside the model.
- Target values snapshot ability and Tailwind effects; changing the field does not move targets.
- Shared links contain a snapshot, not a live collaboration session. Anyone with the link can
  load it. Storage is local to the browser; use JSON exports for durable backups. Compressed
  links need a browser with Compression Streams support; JSON import remains available.
