# DTP modal ground-truth results

Ran `docs/specs/dtp-ground-truth.py` against `public/data/hayden.parquet` with
duckdb in a scratch venv (`cd /tmp && mkdir -p dtp-gt && cd dtp-gt && uv venv
&& uv pip install duckdb`), then reproduced every scenario in the running app
(`npm run dev -- --port 5199`) with Playwright, reading the DTP modal's card
counts and each section's "of N charges in the current view" denominator.

Two adaptations from the brief's template, both noted inline in the script:

- **Court value.** The template's placeholder `'BMC Central'` does not occur
  in the data. `SELECT DISTINCT court, count(*) FROM hayden.parquet GROUP BY
  1 ORDER BY 2 DESC` was run first; `'Boston Municipal Court'` (45,030 rows,
  the highest-volume court) was used throughout, in both the SQL and the UI's
  Court filter.
- **Empty-view scenario.** The template's `court='__nope__'` can't be entered
  through the UI: the Court MultiSelect only lists real dictionary values, so
  there is no checkbox for a nonexistent court. Rather than hunt for a
  UI-reachable combination that happens to intersect to zero (courts and
  charge attributes are unevenly distributed, so some pair like
  `court='East Boston Court' AND sex='B'` would work but isn't obviously the
  "same kind of test" as a single filter matching nothing), a disjoint date
  range was chosen as the simplest deterministic empty view:
  `filed_in_window` is true only for `filing_date` in `2022-01-03..2025-12-31`
  (confirmed via `SELECT min(filing_date), max(filing_date) FROM hayden.parquet
  WHERE filed_in_window`), so a `2020-01-01..2020-12-31` date range guarantees
  zero matching rows while still exercising the same "aggregate returns an
  empty result, modal must render 0 everywhere" path the SQL scenario targets.

The custom-grouping scenario (brief Step 2) has no SQL equivalent to run
directly; it was added by hand as `CUSTOM_GROUPING_SQL` /
`CUSTOM_GROUPING_SQL_REVIEW` at the bottom of the script, expressing the same
court IN-list a UI grouping resolves to. In the UI: Categories → New grouping
→ name "Court family", base column Court, one bucket "Central" containing
Boston Municipal Court and Dorchester Court (the two highest-volume courts) →
Save → filter the "Court family" MultiSelect on "Central".

## Raw script output

```
=== filings lens, no filters ===
  NN (prosecute)                          44,501
  NS (case-by-case)                       45,088
  NY (presumption against)                30,563
  Not listed                               1,876
  YY (decline list)                       39,106
  TOTAL                                  161,134
=== filings lens, no filters, review column ===
  Current list                            36,688
  Not reviewed                            93,447
  Proposed, agreed (never adopted)        28,482
  Proposed, disagreed                      2,517
  TOTAL                                  161,134
=== dispositions lens ===
  NN (prosecute)                          43,234
  NS (case-by-case)                       44,769
  NY (presumption against)                28,301
  Not listed                               1,349
  YY (decline list)                       36,267
  TOTAL                                  153,920
=== dispositions lens, review column ===
  Current list                            33,999
  Not reviewed                            90,870
  Proposed, agreed (never adopted)        26,694
  Proposed, disagreed                      2,357
  TOTAL                                  153,920
=== filings + court=Boston Municipal Court ===
  NN (prosecute)                           6,740
  NS (case-by-case)                        9,642
  NY (presumption against)                 6,008
  Not listed                                 170
  YY (decline list)                       13,075
  TOTAL                                   35,635
=== filings + court=Boston Municipal Court, review column ===
  Current list                            12,221
  Not reviewed                            18,493
  Proposed, agreed (never adopted)         4,060
  Proposed, disagreed                        861
  TOTAL                                   35,635
=== filings + date range 2024-01-01..2024-12-31 ===
  NN (prosecute)                          11,699
  NS (case-by-case)                       12,045
  NY (presumption against)                 9,024
  Not listed                                 458
  YY (decline list)                       10,654
  TOTAL                                   43,880
=== filings + date range 2024-01-01..2024-12-31, review column ===
  Current list                             9,974
  Not reviewed                            25,049
  Proposed, agreed (never adopted)         8,142
  Proposed, disagreed                        715
  TOTAL                                   43,880
=== filings + dtp_class filter active (counts must IGNORE it) ===
  NN (prosecute)                          44,501
  NS (case-by-case)                       45,088
  NY (presumption against)                30,563
  Not listed                               1,876
  YY (decline list)                       39,106
  TOTAL                                  161,134
=== empty view: court filter matching nothing ===
  TOTAL                                        0
=== filings + custom grouping 'Court family' bucket 'Central' = {Boston Municipal Court, Dorchester Court} (hand-added, mirrors a UI grouping filter) ===
  NN (prosecute)                          16,762
  NS (case-by-case)                       18,422
  NY (presumption against)                11,364
  Not listed                                 605
  YY (decline list)                       19,223
  TOTAL                                   66,376
=== filings + custom grouping 'Court family' bucket 'Central' = {Boston Municipal Court, Dorchester Court} (hand-added, mirrors a UI grouping filter) (review column) ===
  Current list                            18,102
  Not reviewed                            37,523
  Proposed, agreed (never adopted)         9,622
  Proposed, disagreed                      1,129
  TOTAL                                   66,376
```

Sanity check: scenario 2's Current list (36,688) + Proposed and agreed, never
adopted (28,482) = 65,170, matching the "65,170 of 161,134 filed charges
2022-2025 (40.4%)" figure already on record from the `dtp_review` column's
introduction (commit `d0fb65b`, 2026-08-05). Confirms the SQL semantics here
agree with the prior verified analysis before any UI comparison began.

## Scenario-by-scenario: SQL vs UI

UI state for every row: Filings lens, dev server at `localhost:5199`, no
history dataset. Both modal sections (decline list / review status) share one
denominator per view, so both are checked together each time the modal is
opened.

### 1. Filings lens, no filters

| category | SQL | UI | match |
|---|---:|---:|---|
| On the decline list (YY) | 39,106 | 39,106 | yes |
| Presumption against (NY) | 30,563 | 30,563 | yes |
| Case-by-case (NS) | 45,088 | 45,088 | yes |
| Ordinarily prosecuted (NN) | 44,501 | 44,501 | yes |
| Not listed | 1,876 | 1,876 | yes |
| denominator | 161,134 | 161,134 | yes |

**PASS**

### 2. Filings lens, no filters, review column

(Same view as scenario 1; the review section renders alongside the decline
list section in the same modal open.)

| category | SQL | UI | match |
|---|---:|---:|---|
| Current list | 36,688 | 36,688 | yes |
| Proposed and agreed, never adopted | 28,482 | 28,482 | yes |
| Proposed, rejected | 2,517 | 2,517 | yes |
| Not reviewed | 93,447 | 93,447 | yes |
| denominator | 161,134 | 161,134 | yes |

**PASS**

### 3. Dispositions lens

| category | SQL | UI | match |
|---|---:|---:|---|
| On the decline list | 36,267 | 36,267 | yes |
| Presumption against | 28,301 | 28,301 | yes |
| Case-by-case | 44,769 | 44,769 | yes |
| Ordinarily prosecuted | 43,234 | 43,234 | yes |
| Not listed | 1,349 | 1,349 | yes |
| Current list | 33,999 | 33,999 | yes |
| Proposed and agreed, never adopted | 26,694 | 26,694 | yes |
| Proposed, rejected | 2,357 | 2,357 | yes |
| Not reviewed | 90,870 | 90,870 | yes |
| denominator | 153,920 | 153,920 | yes |

**PASS**

### 4. Filings + court = Boston Municipal Court

| category | SQL | UI | match |
|---|---:|---:|---|
| On the decline list | 13,075 | 13,075 | yes |
| Presumption against | 6,008 | 6,008 | yes |
| Case-by-case | 9,642 | 9,642 | yes |
| Ordinarily prosecuted | 6,740 | 6,740 | yes |
| Not listed | 170 | 170 | yes |
| Current list | 12,221 | 12,221 | yes |
| Proposed and agreed, never adopted | 4,060 | 4,060 | yes |
| Proposed, rejected | 861 | 861 | yes |
| Not reviewed | 18,493 | 18,493 | yes |
| denominator | 35,635 | 35,635 | yes |

**PASS**

### 5. Filings + date range 2024-01-01..2024-12-31

| category | SQL | UI | match |
|---|---:|---:|---|
| On the decline list | 10,654 | 10,654 | yes |
| Presumption against | 9,024 | 9,024 | yes |
| Case-by-case | 12,045 | 12,045 | yes |
| Ordinarily prosecuted | 11,699 | 11,699 | yes |
| Not listed | 458 | 458 | yes |
| Current list | 9,974 | 9,974 | yes |
| Proposed and agreed, never adopted | 8,142 | 8,142 | yes |
| Proposed, rejected | 715 | 715 | yes |
| Not reviewed | 25,049 | 25,049 | yes |
| denominator | 43,880 | 43,880 | yes |

**PASS**

### 6. Filings + dtp_class filter active (counts must IGNORE it)

Set the YY (decline list) checkbox in the modal, clicked Apply (main view
dropped to 39,106 rows, confirming the filter took), reopened the modal.
Counts must equal scenario 1, unchanged, not shrunk to the 39,106-row
filtered view.

| category | SQL (= scenario 1) | UI (dtp_class=YY active) | match |
|---|---:|---:|---|
| On the decline list | 39,106 | 39,106 | yes |
| Presumption against | 30,563 | 30,563 | yes |
| Case-by-case | 45,088 | 45,088 | yes |
| Ordinarily prosecuted | 44,501 | 44,501 | yes |
| Not listed | 1,876 | 1,876 | yes |
| denominator | 161,134 | 161,134 | yes |

The "On the decline list" checkbox rendered checked (reflecting the staged
filter state) while the count next to it still read the full unfiltered
39,106, confirming the modal reads the checkbox state and the count from two
different sources as designed. **PASS**

### 7. Empty view (court filter matching nothing → substituted disjoint date range)

Date range set to 2020-01-01..2020-12-31 under the Filings lens (main view:
"0 charge rows in view", "No rows match the current filters").

| category | SQL | UI | match |
|---|---:|---:|---|
| On the decline list | 0 | 0 | yes |
| Presumption against | 0 | 0 | yes |
| Case-by-case | 0 | 0 | yes |
| Ordinarily prosecuted | 0 | 0 | yes |
| Not listed | 0 | 0 | yes |
| Current list | 0 | 0 | yes |
| Proposed and agreed, never adopted | 0 | 0 | yes |
| Proposed, rejected | 0 | 0 | yes |
| Not reviewed | 0 | 0 | yes |
| denominator | 0 | 0 | yes |

All ten cards render with an explicit "0" rather than disappearing or
crashing. **PASS**

### 8. Custom grouping: "Court family" bucket "Central" = {Boston Municipal Court, Dorchester Court}

Built in Categories → New grouping (base column Court, one bucket "Central"
with those two courts assigned), then filtered the "Court family" MultiSelect
in the Filters panel on "Central" (main view: "66,376 charge rows in view").

| category | SQL | UI | match |
|---|---:|---:|---|
| On the decline list | 19,223 | 19,223 | yes |
| Presumption against | 11,364 | 11,364 | yes |
| Case-by-case | 18,422 | 18,422 | yes |
| Ordinarily prosecuted | 16,762 | 16,762 | yes |
| Not listed | 605 | 605 | yes |
| Current list | 18,102 | 18,102 | yes |
| Proposed and agreed, never adopted | 9,622 | 9,622 | yes |
| Proposed, rejected | 1,129 | 1,129 | yes |
| Not reviewed | 37,523 | 37,523 | yes |
| denominator | 66,376 | 66,376 | yes |

**PASS**

## Summary

| # | Scenario | Result |
|---|---|---|
| 1 | Filings lens, no filters (decline list) | PASS |
| 2 | Filings lens, no filters (review column) | PASS |
| 3 | Dispositions lens | PASS |
| 4 | Filings + court filter | PASS |
| 5 | Filings + date range | PASS |
| 6 | dtp_class filter active, counts ignore it | PASS |
| 7 | Empty view (0 rows) | PASS |
| 8 | Custom grouping filter (hand-added) | PASS |

8 of 8 scenarios pass. No mismatches found; nothing to report as BLOCKED.
