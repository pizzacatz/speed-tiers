# Speed Lab: group comparison concept

Open `speed-lab.html` directly in a browser. It embeds the roster, sprites and existing calculation
engine, works offline, and needs no server.

Compare one explicit set against a group of up to 24 explicit benchmarks. Multiple sets of the same
Pokémon can coexist. Each row shows investment, alignment, item, ability, active individual effects,
effective Speed and whether you move first, tie or move after it.

The interface separates your set, the shared battlefield and the benchmark group. Edits to your set
or battlefield start a reversible trial, with current versus trial coverage and per-row gains/losses.
Keep commits the trial for this session; Revert restores all trial changes. Benchmark edits redefine
the comparison group for both scenarios. Suggestions calculate improvements across the group.

Select a row to inspect its explanation and calculation, edit its set or duplicate it. Hover only
changes styling. The optional Speed ladder shows numerical Speed; result labels still account for
priority and Trick Room. Collapsed battle effects retain an explicit summary of active settings.

This is an interactive design concept. It does not persist changes, import teams, validate team SP
budgets, or model damage and every within-priority ordering mechanic. Reset demo restores the
sample group. The full application and production GitHub Pages site are unchanged.

## Development

Edit `src/index.html`, `src/app.css` and `src/app.js`, then generate the standalone artifact:

```sh
python3 mockups/build.py
node --test mockups/group.test.js
```

Run commands from the repository root after `npm ci`. Tests exercise trial reversibility, predicted
group gains, independent benchmark sets, selected abilities, shared weather, priority, filtering,
empty states and hover stability. They do not verify rendered appearance.
