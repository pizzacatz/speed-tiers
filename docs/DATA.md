# Embedded data

`data/roster.json` is the committed offline snapshot obtained through the **champions-logic MCP**.
Current revision: **b69c0ab9992b61c7**, version **M-C+2026-09-14**, server **5.0.0**.
It contains **264 legal species/formes + 82 Mega forms**. Every species record was fetched with
`species_info`, including its Mega forms, base Speed, types, abilities, and sprite paths.
Ability behavior comes from `ability_info`; alignments from `stat_alignment`; metadata from
`server_info`. `query` is used only to enumerate species slugs, filtered by the active regulation.

```text
meta: regulation, dataVersion, dataRevision, source, serverVersion, dataBuiltAt, species, megas
entities: id, name, dex, types, spe (base Speed), abil (modeled Speed abilities), allAbil,
          mega (base entity ID or null), stone (Megas), sprite (index)
abilities: name, description, mult, cond
alignments: MCP stat_alignment records
sprites: embedded 56×56 WebP data URIs
previousEntities: original M-B entity IDs used for version-1 state migration
```

Sprites are read only from the MCP-provided `assets.root` joined with each returned sprite path.
Menu sprites are preferred, with shiny menu/front fallback; a missing Mega sprite can use its base
species sprite. Current snapshot contains 345 distinct images. Sprites are cropped and scaled to
56×56, encoded as WebP quality 85. No runtime image requests are made.

`build.py` reads this snapshot and inlines it with `src/engine.js`, `src/state.js`, and `src/app.html`.
It is deterministic and requires only Python 3. It never connects to the MCP or reads a sibling
repository. The displayed build date is the MCP dataset's build date.

## Refreshing from the MCP

1. Call `getting_started` and `server_info`; read current regulation/stat documents.
2. Enumerate slugs with `query`: `SELECT slug FROM species WHERE regulation = '<current>'`.
3. Fetch each slug with `species_info` (typed records include Mega forms). Fetch all alignments
   with `stat_alignment`, supported abilities with `ability_info`, and Speed items with `item_info`.
   Do not fill gaps from another game's dex. Check whether the supported modifiers changed.
4. Save those decoded responses to a temporary JSON file with this structure:

```text
{
  meta: {regulation, dataVersion, dataRevision, source: "champions-logic MCP",
         serverVersion, dataBuiltAt},
  species: [species_info responses],
  alignments: stat_alignment.alignments,
  abilities: [found ability_info responses],
  items: [found item_info responses],
  assetsRoot: server_info.assets.root
}
```

5. Run the importer (requires Pillow and access to the returned sprite files):

```bash
python3 scripts/import_mcp.py /path/to/mcp-export.json
python3 build.py
npm test
```

6. Capture current `speed_order` results in `test/mcp-vectors.json`, including new Mega forms,
   rounding and priority cases. `speed_order` accepts ability multipliers as flags; Quick Feet's
   paralysis exception is taken from `ability_info` and represented explicitly in its fixture.
7. Commit the snapshot, source, fixtures and regenerated HTML, then push to publish through Pages.

The metadata revision identifies exact upstream content; a date-based version alone is insufficient.
