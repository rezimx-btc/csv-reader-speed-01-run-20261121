# csv-reader-speed-01-run-20261121-v1

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/rezimx-btc/csv-reader-speed-01-run-20261121-v1/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/rezimx-btc/csv-reader-speed-01-run-20261121-v1/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own **csv-reader 1.0.0**: `solve.js` answers
every case exactly as csv-reader does — the JSON value `{columns, rows,
errors}` for an input `{text, header}` — and `main.ts` is the program the
harness runs, reading every case from `/input/cases.json` and writing
`/output/answers.json`.

## What it does

It reads a CSV text once, left to right, with commas and double quotes:

- A U+FEFF at the very start is dropped.
- A record ends at LF or CRLF; a line left with no characters is no record.
- Outside quotes a CR not followed by LF is dropped (`stray_cr`).
- A field that opens with a quote runs to the next quote that is not doubled;
  `""` inside it is one quote, each CRLF or lone CR inside it is read as LF;
  what follows its closing quote up to the next comma or line break is
  appended as it stands (`quote_junk`, when the field ends); a quote that
  never closes is a literal character and the text after it is read again as
  unquoted (`unterminated_quote`).
- A quote inside an unquoted field is a literal character. Fields stay
  strings, never trimmed or converted.
- `columns` is the first record when `header` is true, else null; `rows`
  holds the records after it (every record when `header` is false), each
  padded with empty strings (`short_row`, with `fields`: its field count) or
  cut (`long_row`, with `extra`: the cut fields) to the first record's width.
- Each error is `{code, line, row}`, in the order met; `line` is the 1-based
  line its record starts on (counting every LF, CRLF and lone CR inside
  quotes), `row` its record's index in `rows`, null for the header.

## How it is faster

The reference reader builds every field one character at a time
(`text[i]` string indexing plus `value += c` per character). This reader
instead:

- takes each **unquoted field as one slice**, bounded by native `indexOf`
  scans for `,` and `\n` — no per-character loop and no string concatenation
  on the hot path, which is most fields;
- takes each **quoted field as slices** between its special characters
  (doubled quotes, CR/LF), joining only when such a character occurs;
- tracks the next CR lazily (one native scan per CR, never one per field),
  so stray-CR and CRLF handling costs nothing on clean text;
- keeps all error/line bookkeeping in plain locals, with no per-field
  function calls and no regex or `split` in the hot path;
- runs with V8's incremental marking off, as the house driver does.

Measured on the kit practice set (6 cases, ~10.2 MB of CSV): pure parse
~80 ms median vs ~400–690 ms for the reference reader (~5x); end-to-end
~0.7 s vs ~1.4–2.4 s for the house baseline (~2x — the rest is JSON
parse/stringify and Node startup, which every entry pays). Practice-set
exactness: **6/6 cases identical** to csv-reader 1.0.0 (scorer `passed: 1`).

## How to run / verify

```sh
# Run on the kit practice set (from the kit directory):
MAKEFUN_INPUT_DIR=<kit>/practice/input MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts

# Score the output against the practice reference:
MAKEFUN_OUTPUT_DIR=/tmp/out MAKEFUN_REFERENCE_DIR=<kit>/practice/reference \
  MAKEFUN_SCORES_DIR=/tmp/scores node <kit>/program/scorer/main.ts
```

Requires Node 22.18+ (the harness runs Node 22.23.4). No dependencies, no
network, no build step: `solve.js` is a dependency-free ES module and
`main.ts` runs as-is under Node 22's type stripping.

## Files

- `solve.js` — the fast reader; exports `run(input)`.
- `main.ts` — the harness driver.
- `README.md` — this file.
- `LICENSE` — MIT.
- `.makefun/owner.json` — the entry's claim file (payout wallet).
