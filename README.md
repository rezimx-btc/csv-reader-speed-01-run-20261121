[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/rezimx-btc/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/rezimx-btc/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# CSV Reader Speed

A fast, dependency-free CSV reader that is a drop-in replacement for csv-reader 1.0.0: it returns exactly the same `{columns, rows, errors}` answers for every case, including all of the broken-input edge cases (quoted fields, doubled quotes, stray CRs, unterminated quotes, short and long rows), while running much faster than the house baseline — about 2x end-to-end and about 5x on pure parsing. It passes the practice set 6/6 exact.

## How to run

The entrypoint is `main.ts` (Node 22.18 or later). It reads every case from `/input/cases.json`, answers each one with `run` from `solve.js` — the fast parser — and writes `/output/answers.json`:

```sh
node main.ts
```

## Files

- `main.ts` — the program the harness runs: reads `/input/cases.json`, writes `/output/answers.json`.
- `solve.js` — the fast, dependency-free CSV parser. Exports `run(input)`, which returns `{columns, rows, errors}` exactly as csv-reader 1.0.0 does.
- `LICENSE` — MIT.

## Bounty

This entry was built for the [CSV Reader Speed bounty on make.fun](https://make.fun/bounty/csv-reader-speed-01-run-20261121) — $100 USDC across the 10 fastest entries that beat the house baseline.
