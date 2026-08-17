# Champions Speed Tiers

A single-file, fully offline speed-tier calculator for **Pokémon Champions (Regulation M-B)**.

**Use it:** open [`speed-tiers.html`](speed-tiers.html) in any modern browser. No server, no network, no install.
Everything (roster data, sprites, engine, UI) is embedded in that one file (~1 MB).

![layout](docs/layout.txt)

## What it does

| Area | Details |
|---|---|
| Roster | Every Regulation M-B legal species and Mega form, with base Speed, types, speed-relevant abilities and menu sprite. |
| Columns | Preset "what-if" specs shown side by side: **Min** (0 SP, −Spe), **Base** (0 SP, neutral — the in-game presented stat), **Max** (32 SP, +Spe), **Scarf**, **+1**, **−1**, **Tailwind**, **Scarf+TW**. Click a column to sort by it; hide, drag-reorder, edit, or add your own (e.g. *Max in Rain*). Columns default to content-fit width (nothing wraps or is clipped); drag a header's right edge to resize, double-click it to auto-fit. Widths are saved. |
| Tags | Arbitrary labels with optional defaults. Seeded: **My Team** (side A), **Opponent** (side B), **Watchlist**, **Trick Room** (0 SP, −Spe), **Scarfer** (Choice Scarf). Filter rows by tag (any/all). |
| Row overrides | Per-row facts (SP, alignment, stage, item, ability mode, Tailwind, paralysis, priority, side). Click a Pokémon's name to open the editor with a full step-by-step breakdown per column. |
| Field bar | Weather (☀/🌧/🏜/❄), Electric Terrain, Trick Room, Tailwind per side (A/B). Weather/terrain auto-activate Chlorophyll, Swift Swim, Sand Rush, Slush Rush and Surge Surfer for rows whose ability mode is *auto*. |
| Anchor dock | Pin any rows (◆). Every anchor gets its own **stacked card** under the header (drag ⋮⋮ to reorder, ▾ to collapse), its own colored **vs** column in the table (outspeeds / speed tie / slower ±N at the sort column), and a colored divider row marking where it sits. Edit each anchor's set live; hovering a row shows what each anchor needs to beat it. |
| Targets | Click any speed cell — e.g. *Swampert-Mega × Min* while Rain is on — to mark it 🎯 as a value to beat. The cell's ability/Tailwind state is snapshotted so the target does not move when the field bar changes (click the chip to relabel/edit). Every anchor card then shows ✓/✗ against every target plus the minimal change that beats it by at least 1 point: `SP ≥ n (speed)`, `+Spe alignment, SP ≥ n`, `Choice Scarf`, `Stage +n`, `Tailwind`. |
| Persistence | Auto-saved to `localStorage`. **Export / Import** JSON to back up or share. **Reset** restores defaults. |
| Misc | Dark / light / auto theme, `/` focuses search, `?` opens in-app help. |

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
build.py             ← generates speed-tiers.html from the champions_logic DB + sprites
src/app.html         ← UI template (CSS + JS); /*__DATA__*/ and /*__ENGINE__*/ are injected
src/engine.js        ← pure speed engine, shared by the app and the tests
test/engine.test.js  ← node tests for the engine
docs/ARCHITECTURE.md ← state model, resolution pipeline, rendering, extension points
docs/DATA.md         ← what data is embedded, where it comes from, how to refresh it
```

## Rebuild

Requires Python 3 + Pillow, and a checkout of [`champions_logic`](https://github.com/pizzacatz/champions_logic) as a sibling folder
(or set `CHAMPIONS_LOGIC_ROOT`).

```bash
python3 build.py            # → speed-tiers.html ; prints species/mega/sprite counts + data revision
node test/engine.test.js    # engine conformance vectors
```

The page footer shows the embedded data version/revision so you can tell which regulation snapshot a copy reflects.

## Data & credits

Species, Mega and ability data come from the `champions_logic` database (Regulation M-B). Sprites are © Nintendo / Game Freak,
vendored for local use only — this repository is private for that reason; do not redistribute the built file publicly with them embedded.
