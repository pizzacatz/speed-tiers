# Embedded data

`build.py` reads the [`champions_logic`](https://github.com/pizzacatz/champions_logic) SQLite database
(`data/champions_logic.db`) and sprite tree, and embeds a JSON blob:

```
{
  meta:      { regulation:'M-B', dataVersion, dataRevision, built, species, megas },
  abilities: { slug: { mult, cond, name } },      // speed-modifying abilities the engine models
  alignments:[ { alignment, raises, lowers } ],   // all 21 Stat Alignments (informational)
  entities:  [ { id, name, dex, types[], spe, abil[], allAbil[], mega:null|baseId, stone?, sprite:idx } ],
  sprites:   [ 'data:image/webp;base64,…' ]       // 56×56 WebP menu icons, deduplicated
}
```

- **Entities** = every legal species (table `species`, regulation `M-B`) plus every Mega form (`mega_evolution`).
  Megas are separate rows with `mega` = base slug; their base Speed is the Mega's.
- **`abil`** lists only speed-relevant abilities the entity can have (from `species_ability` / the Mega's fixed ability).
  `allAbil` is the full ability list, shown in the row editor for context.
- **Sprites**: `menu` variant, falling back to `shiny_menu` then `front`; cropped to content, fit into 56×56, WebP q85.
  Total ≈ 870 KB of the ~1 MB file. Two entities (Meowstic-F, Basculegion-F) currently have no sprite in the source and show a blank tile.
- **Modelled abilities**: Chlorophyll (sun), Swift Swim (rain), Sand Rush (sand), Slush Rush (snow), Surge Surfer (Electric Terrain) ×2;
  Unburden ×2, Quick Feet ×1.5, Protosynthesis/Quark Drive ×1.5, Slow Start ×0.5 (manual `on`, no field condition).
  Speed Boost / stat-stage abilities are represented through the **Stage** control.

## Refreshing after a regulation update

```bash
cd champions_logic && git pull        # or however the DB is rebuilt
cd ../speed-tiers && python3 build.py
```
The footer of the app shows `dataVersion` and `dataRevision`; compare against `champions-logic`'s `server_info` to confirm parity.
Set `CHAMPIONS_LOGIC_ROOT=/path/to/champions_logic` if it is not a sibling folder.
