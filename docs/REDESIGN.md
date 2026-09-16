# Focused comparison redesign

Branch: `redesign/focused-compare`. This is a reviewable alternative to `master`, not a production deployment.
Open the generated `speed-tiers.html` locally to try it, or serve the repository with `python3 -m http.server`.
The GitHub Pages workflow continues to publish only pushes to `master`.

## What to try

1. The app opens in **Compare** with a complete example: Garchomp against Lucario-Mega-Z at maximum Speed.
2. Choose **your Pokémon** by clicking its name. Set Speed SP, alignment, and held item directly;
   stage, move priority, ability, and paralysis are under **More set options**.
3. Search the roster and select an opponent. Hover only highlights; it never changes the comparison.
   The selected opponent stays in the panel as you browse.
4. Read the move-order result and alternative changes needed to move first. Weather and each side's
   Tailwind are shared field controls; Trick Room and priority are accounted for by the existing engine.
5. The opponent preset applies the same assumptions to the roster. Editing an opponent's set switches
   the preset to Custom. The roster's difference column is numeric Speed difference, while its caption
   explains move order (including priority and Trick Room).
6. Switch to **Full tiers** to use the existing column presets, tags, row overrides, multiple anchors,
   and frozen targets. Compare has its own two sets; it does not overwrite those advanced rows.
7. Save or share a setup: both workspaces and the selected view are preserved. Older setups gain the
   default Compare view when loaded. Offline copies share through JSON export, rather than sending a
   URL to a deployed version that may not match this branch.

## Layout

Desktop uses a quiet roster beside a persistent comparison panel. Narrow screens put the selected
matchup and set editors first, followed by the browsable roster. The header has two workspace tabs;
secondary file, theme, help, and reset actions are in More. Data provenance remains available at the bottom.
No image requests, fonts, framework, or runtime dependencies have been added.

## Implementation and checks

`src/compare.css` and `src/compare.js` are inlined by `build.py`. The existing engine is unchanged.
`StateModel` validates the optional `compare` state, including species IDs and Speed parameters, for
local storage, imports, named setups and share links. Current state remains version 2 so older exports
continue to load. The old published app will ignore the new Compare settings until this branch is merged.

`npm test` includes the existing regression suite plus focused-workspace selection, stable hover,
field/priority changes, species picker, preset editing, SP clamping, and share restoration tests.
These are jsdom interaction tests; they do not measure browser layout or native dialog behavior.
The branch check workflow builds and tests without deploying.
