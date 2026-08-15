# Severity and statute-chapter ground-truth results

Ran `docs/specs/severity-chapter-ground-truth.py` against the two ASSEMBLED
CSVs, not the parquets the running app reads: `../../../assembled/hayden-
era-charges-2022-2025.csv` and `../../../assembled/pre-2022-composite.csv`,
relative to the script's own directory (`docs/specs/`). Used the repo's own
`.venv` (`source .venv/bin/activate`; duckdb 1.5.5 is already installed
there, confirmed with `python3 -c "import duckdb; print(duckdb.__version__)"`
before writing the script), run as:

```
cd "data/suffolk-explorer" && source .venv/bin/activate && cd docs/specs \
  && python3 severity-chapter-ground-truth.py
```

**Path note, one adaptation from the task brief.** The brief's shorthand
"`../../assembled/`" is the path from `docs/` (this repo's root is
`data/suffolk-explorer/`, and `assembled/` is a sibling of that root under
`data/`). The script lives one level deeper, in `docs/specs/`, so the
working relative path from there is `../../../assembled/` (three levels
up: `docs/specs` → `docs` → `suffolk-explorer` → `data`). Verified with
`ls ../../assembled` (fails) vs `ls ../../../assembled` (lists the CSVs)
from `docs/specs/` before writing the query paths into the script.

**Why two different source shapes for the two columns.** `severity_class`
is a real, pass-through column in `hayden-era-charges-2022-2025.csv` only;
the pre-2022 composite carries no `severity_class` column at all.
`prepare_history.py` (the parquet build, not the CSV assembly) stamps the
literal constant `"Not graded (pre-2022)"` onto every row of the composite
unconditionally when it builds `history.parquet`. So this script's ground
truth for that constant (scenario 5) is simply the composite's total row
count, not a filtered query; there is no column to group by. `statute_chapter`
exists in neither assembled CSV; both prep scripts (`prepare_data.py` and
`prepare_history.py`) derive it from `charge_code` with the identical regex
`^([0-9]+[A-Z]?)[/.]` → `"c. " + token`, else `"No statute code"`. This
script reimplements that regex independently in SQL
(`regexp_matches`/`regexp_extract`, matching Python's `re.match` anchored
at the string start) rather than importing or re-running the prep scripts,
so a bug shared between the two prep scripts would not also be baked into
this check.

## Raw script output, verbatim

```
=== 1. Severity counts overall (hayden-era CSV, all rows) ===
  Civil infraction                                    20,101
  Felony                                              61,117
  Misdemeanor                                        116,607
  Unclassified                                         2,805
  TOTAL                                              200,630
=== 2. Severity x dtp_class YY (hayden-era CSV, dtp_class LIKE 'YY%') ===
  Felony                                               6,188
  Misdemeanor                                         41,952
  Unclassified                                             6
  TOTAL                                               48,146
=== 3. Severity for court = Suffolk Superior Court (hayden-era CSV) ===
  Civil infraction                                         1
  Felony                                               8,768
  Misdemeanor                                          3,387
  Unclassified                                            90
  TOTAL                                               12,246
=== 4a. Chapter counts, ALL chapters, hayden-era CSV (chapter rule recomputed) ===
  c. 90                                               51,150
  c. 265                                              47,585
  c. 266                                              30,141
  c. 94C                                              20,138
  c. 269                                              16,632
  c. 272                                               6,059
  c. 268                                               5,406
  c. 89                                                4,970
  c. 275                                               4,181
  c. 209A                                              2,788
  No statute code                                      2,658
  c. 234A                                              2,320
  c. 274                                               1,088
  c. 267                                                 776
  c. 276                                                 756
  c. 140                                                 677
  c. 6                                                   640
  c. 258                                                 625
  c. 90B                                                 267
  c. 40                                                  224
  c. 101                                                 207
  c. 159A                                                190
  c. 127                                                 137
  c. 85                                                  136
  c. 270                                                 135
  c. 138                                                 123
  c. 64C                                                 122
  c. 22E                                                  68
  c. 131                                                  61
  c. 160                                                  42
  c. 148                                                  39
  c. 161A                                                 33
  c. 119                                                  25
  c. 140D                                                 21
  c. 279C                                                 20
  c. 18                                                   18
  c. 271                                                  17
  c. 161                                                  16
  c. 267A                                                 11
  c. 94G                                                  10
  c. 159                                                  10
  c. 21A                                                  10
  c. 264                                                   9
  c. 130                                                   9
  c. 208                                                   8
  c. 90D                                                   7
  c. 112                                                   7
  c. 234                                                   5
  c. 56                                                    4
  c. 10                                                    4
  c. 268A                                                  4
  c. 19A                                                   4
  c. 94                                                    3
  c. 91                                                    3
  c. 151A                                                  3
  c. 62C                                                   3
  c. 118E                                                  3
  c. 142A                                                  3
  c. 55                                                    3
  c. 111                                                   2
  c. 102                                                   2
  c. 120                                                   2
  c. 166                                                   2
  c. 141                                                   1
  c. 159B                                                  1
  c. 42                                                    1
  c. 175                                                   1
  c. 175H                                                  1
  c. 162                                                   1
  c. 87                                                    1
  c. 31                                                    1
  TOTAL                                              200,630
=== 4b. Chapter counts, top 10 by volume (hayden-era CSV) ===
  c. 90                                               51,150
  c. 265                                              47,585
  c. 266                                              30,141
  c. 94C                                              20,138
  c. 269                                              16,632
  c. 272                                               6,059
  c. 268                                               5,406
  c. 89                                                4,970
  c. 275                                               4,181
  c. 209A                                              2,788
  No statute code                                      2,658
  distinct chapter values total (incl. No statute code)        71
=== 4c. EXTRA: chapter counts, top 10, hayden-era + pre-2022 composite combined ===
  c. 90                                              310,872
  c. 265                                             269,312
  c. 266                                             199,637
  c. 94C                                             181,330
  c. 269                                              71,039
  c. 272                                              48,261
  c. 268                                              38,892
  No statute code                                     37,636
  c. 275                                              29,895
  c. 89                                               27,342
  c. 209A                                             17,623
  TOTAL                                            1,231,839
=== 5. History row count = the 'Not graded (pre-2022)' severity count ===
  Not graded (pre-2022)                            1,092,889
=== 6. Severity counts under filed_under = Hayden (hayden-era CSV) ===
  Civil infraction                                    17,441
  Felony                                              46,252
  Misdemeanor                                         94,262
  Unclassified                                         2,081
  TOTAL                                              160,036
```

Two ties in scenario 4a (`c. 264`/`c. 130` at 9 each, and four more pairs
further down the tail) can print in either order across runs because the
query's `ORDER BY n DESC` has no secondary sort key; this does not affect
the top-10 list in 4b, where every value is distinct.

## Sanity checks against numbers already on record

- Scenario 1's total, 200,630, matches `DESIGN.md`'s acceptance-check row
  count for `hayden.parquet` ("total rows 200,630") and the parquet's
  gate-printed severity distribution in `scripts/prepare_data.py`'s
  `severity {...}` line at build time.
- Scenario 5's 1,092,889 matches `history.parquet`'s row count as recorded
  in `docs/specs/dtp-ground-truth-results.md`'s Task 7 row 12
  ("history 63,555/**1,092,889** = 5.82%") and the assembled `README.md`'s
  history total.
- Scenario 6's total, 160,036, matches `DESIGN.md`'s acceptance-check line
  "filed_under Hayden=160,036."
- Scenario 4b's top-10-by-volume chapters are exactly the same *set* of 10
  tokens as the first 10 keys in `chapterModel.ts`'s `CHAPTER_TITLES` map
  (90, 265, 266, 94C, 269, 272, 268, 275, 89, 209A there, in that literal
  key order; 90, 265, 266, 94C, 269, 272, 268, 89, 275, 209A by volume here,
  with only 275 and 89 swapped between the two orderings, a 789-charge
  difference), confirming the shipped title map's first 10 entries prioritize
  real volume rather than an arbitrary or alphabetical list.

## Claims table: UI-displayed number class -> derivation

Each row names a class of number the Severity or Statute chapter modal can
show on screen (a card count, a row count, a denominator), not one single
example value, since the live figure changes with whatever filters and lens
are active in the view. The "Ground truth scenario" column is what a
reviewer should reproduce in the running app (no filters beyond the one
named, Filings lens unless noted) and compare against script output above.

| # | UI-displayed number class | Where it renders | Ground truth scenario | Verified value(s) |
|---|---|---|---|---|
| 1 | Severity card counts with no other filter active, history off | `SeverityFilterModal`, one count per card (Felony/Misdemeanor/Civil infraction/Unclassified) | Scenario 1 | Civil infraction 20,101; Felony 61,117; Misdemeanor 116,607; Unclassified 2,805; denominator 200,630 |
| 2 | Severity card counts with the Decline-to-prosecute filter set to "On the decline list" (`dtp_class` = `YY (decline list)`) active | `SeverityFilterModal`, same four cards, counts change when a co-active filter narrows the view | Scenario 2 | Felony 6,188; Misdemeanor 41,952; Unclassified 6 (Civil infraction 0, not printed by the GROUP BY); denominator 48,146 |
| 3 | Severity card counts with Court filtered to Suffolk Superior Court | `SeverityFilterModal` | Scenario 3 | Civil infraction 1; Felony 8,768; Misdemeanor 3,387; Unclassified 90; denominator 12,246 |
| 4 | Chapter row counts and their sort order (highest volume first, "No statute code" pinned last only while unsearched) | `ChapterFilterModal`, one row per `c. NNN` value plus "No statute code" | Scenario 4a (full ranking) / 4b (top 10 the way `CHAPTER_TITLES` prioritizes them) | Top 10: c. 90 51,150; c. 265 47,585; c. 266 30,141; c. 94C 20,138; c. 269 16,632; c. 272 6,059; c. 268 5,406; c. 89 4,970; c. 275 4,181; c. 209A 2,788. No statute code: 2,658. 71 distinct chapter values total |
| 5 | Chapter row counts with the history dataset included (Not graded rows do not change chapter counts; the composite's own charges add to each chapter's total) | `ChapterFilterModal`, `view.history = true` | Scenario 4c (extra, not in the brief's minimum list, added because chapter is derived identically in both files and the modal reads across the toggle) | Top 10 combined: c. 90 310,872; c. 265 269,312; c. 266 199,637; c. 94C 181,330; c. 269 71,039; c. 272 48,261; c. 268 38,892; No statute code 37,636; c. 275 29,895; c. 89 27,342; c. 209A 17,623 |
| 6 | The "Not graded (pre-2022)" severity card's count, shown only when `view.history` is true | `SeverityFilterModal`, the fifth card, appended only when history is on (`SeverityFilterModal.tsx`'s `cards` computation) | Scenario 5 | 1,092,889 (every row of the pre-2022 composite; the constant is unconditional, not filtered) |
| 7 | Severity card counts under `filed_under = Hayden` (a DA-administration filter, exercises a filter column unrelated to severity/chapter) | `SeverityFilterModal` | Scenario 6 | Civil infraction 17,441; Felony 46,252; Misdemeanor 94,262; Unclassified 2,081; denominator 160,036 |
| 8 | The "Severity filter excludes 2006-2021" notice's presence/absence | `Notices.tsx` banner, driven by `noticesFor` in `src/engine/notices.ts` | Not a duckdb scenario: a pure function of `view.filters.severity_class`, `view.history`, and whether the selection includes `"Not graded (pre-2022)"`. Covered directly by `src/engine.test.ts`'s `'warns that an active severity filter excludes the pre-2022 dataset...'` test (4 cases: history+filter, history off, no filter, filter includes Not graded) | All four `it` assertions pass under `npx vitest run` |

Row 2's "Civil infraction 0" is not a printed line in the scenario-2 SQL
output (the `GROUP BY severity_class` only emits rows for values present
under the filter, and no civil-infraction charge in this file carries the
YY decline-list tag), so a reviewer comparing against the live modal should
expect that card to render an explicit `0`, not to be absent from the card
list; `SeverityFilterModal.tsx` always renders all four (or five, with
history) cards regardless of whether a given value has any matching rows in
the current view (see `SeverityFilterModal.tsx`'s `byValue.get(card.value)
?? 0` fallback).

Row 4/5's "No statute code" position moves from rank 11 (hayden-only) to
rank 8 (combined with history): scenario 4a's 71-value full ranking and 4c's
combined ranking both print the exact counts needed to confirm either
ordering, so this is not a discrepancy, just two different views' natural
sort orders.

## What this script does not attempt

Per the task brief and the DTP precedent (`docs/specs/dtp-ground-truth.py`
/ `dtp-ground-truth-results.md`), this script only produces the duckdb-side
numbers. Reproducing each scenario in the running app with Playwright and
recording a scenario-by-scenario SQL-vs-UI table (the DTP results file's
"Scenario-by-scenario: SQL vs UI" section) is part of the adversarial
review gauntlet the controller runs after Task 3 completes, not this task;
this results file gives that reviewer the exact numbers to check the DOM
against and the exact commands to reproduce them.
