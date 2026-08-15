# Severity/chapter filter numbers verification — round 1

Branch: `severity-chapter-filters`. Dev server: http://localhost:5173.
Independent truth: duckdb (suffolk-explorer `.venv`, duckdb 1.5.5) directly
against `../assembled/hayden-era-charges-2022-2025.csv` (200,630 rows) and
`../assembled/pre-2022-composite.csv` (1,092,889 rows). No parquet, no cached
prior results were trusted; `severity_class` was read as-delivered in the
Hayden CSV (the parquet build makes no changes to it) and `statute_chapter`
was recomputed with the regex `^([0-9]+[A-Z]?)[/.]` confirmed against both
`scripts/prepare_data.py` and `scripts/prepare_history.py` (identical rule,
identical gate). Pre-2022 rows have no `severity_class` column in the CSV;
the parquet build sets it to the constant `'Not graded (pre-2022)'`
(`prepare_history.py` line 45), which is what the SQL below replicates.

`public/data/*.parquet` (built 2026-08-15 00:02) postdate both source CSVs
(hayden 08-14 16:20, pre2022 08-08 11:35), so the dev server is not serving
stale derived data.

Schema/row-count sanity before any scenario: hayden CSV severity_class
distribution (Felony 61,117 / Misdemeanor 116,607 / Civil infraction 20,101
/ Unclassified 2,805) and dtp_class distribution (YY 48,146 / NY 34,220 /
NS 57,079 / NN 59,061 / Not listed 2,124) both match the assembled README's
own stated numbers exactly, confirming the duckdb read matches the file the
README was written against.

**Result: 11 scenarios run (8 required + 3 invented), 0 mismatches.**
Every DOM value quoted below was read live from the running app, not
inferred or reused from a prior session's numbers.

---

## 1. Severity modal, default view (filings lens, no filters, no history)

SQL:
```sql
SELECT severity_class, COUNT(*) c FROM hayden
WHERE filed_in_window GROUP BY 1 ORDER BY c DESC;
-- Felony 46568, Misdemeanor 94918, Civil infraction 17553, Unclassified 2095
-- total (filed_in_window) = 161134
```

DOM (severity modal cards, `.severity-modal .dtp-card`):

| Card | SQL | DOM | Match |
|---|---|---|---|
| Felony | 46,568 | 46,568 | yes |
| Misdemeanor | 94,918 | 94,918 | yes |
| Civil infraction | 17,553 | 17,553 | yes |
| Unclassified | 2,095 | 2,095 | yes |

Header status bar: "161,134 of 200,630 charge rows" == SQL total. Match.

## 2. Chapter modal, default view, top 8 rows + No statute code

SQL:
```sql
SELECT statute_chapter_calc, COUNT(*) c FROM hayden
WHERE filed_in_window GROUP BY 1 ORDER BY c DESC LIMIT 12;
```
Result: c.90=44041, c.265=37267, c.266=23670, c.94C=15715, c.269=12088,
c.272=4921, c.268=4207, c.89=4190, c.275=3177, c.234A=2258, No statute
code=2203 (rank 11 by count, pinned last in the UI regardless of rank per
`chapterModel.ts`'s pin logic), c.209A=2144.

DOM (`.chapter-row`, top of list plus the pinned last row):

| Chapter | SQL count | DOM count | Match |
|---|---|---|---|
| c. 90 | 44,041 | 44,041 | yes |
| c. 265 | 37,267 | 37,267 | yes |
| c. 266 | 23,670 | 23,670 | yes |
| c. 94C | 15,715 | 15,715 | yes |
| c. 269 | 12,088 | 12,088 | yes |
| c. 272 | 4,921 | 4,921 | yes |
| c. 268 | 4,207 | 4,207 | yes |
| c. 89 | 4,190 | 4,190 | yes |
| No statute code (pinned last, 68th/69th row) | 2,203 | 2,203 | yes |

All 8 top-count rows exact; No statute code exact and correctly pinned to
the very end of the full 69-row list (confirmed by reading the entire DOM
row set, not just the visible top).

## 3. Severity counts with court filter (Suffolk Superior Court), no chapter/severity filter staged

Applied `court = Suffolk Superior Court` as a real filter (URL hash
`...court%3A%5B%22Suffolk+Superior+Court%22%5D`), filings lens.

SQL:
```sql
SELECT severity_class, COUNT(*) c FROM hayden
WHERE filed_in_window AND court = 'Suffolk Superior Court'
GROUP BY 1 ORDER BY c DESC;
-- Felony 6334, Misdemeanor 2468, Unclassified 44 (Civil infraction: 0 rows, absent from GROUP BY)
-- total = 8846
```

DOM:

| Card | SQL | DOM | Match |
|---|---|---|---|
| Felony | 6,334 | 6,334 | yes |
| Misdemeanor | 2,468 | 2,468 | yes |
| Civil infraction | 0 | 0 | yes |
| Unclassified | 44 | 44 | yes |

Header: "8,846 of 200,630 charge rows" == SQL total. Match.

Additionally confirmed the "ignore staged severity selection" cross-filter
rule directly: with the court filter active, toggled the Felony checkbox
*without* clicking Apply, and re-read all four card counts — identical
before and after (6,334 / 2,468 / 0 / 44). This matches
`buildCountViewFor`'s design (own column stripped from the aggregation
entirely; the React `staged` Set never enters the count computation).

## 4. Chapter counts with severity=Felony applied (real filter, plus court filter still active)

Applied both `court = Suffolk Superior Court` and `severity_class = Felony`
as real filters (via the modal's own Apply button for severity).

SQL:
```sql
SELECT statute_chapter_calc, COUNT(*) c FROM hayden
WHERE filed_in_window AND court = 'Suffolk Superior Court' AND severity_class = 'Felony'
GROUP BY 1 ORDER BY c DESC;
```
Result (14 nonzero chapters): c.265=3193, c.269=1298, c.94C=1167, c.266=267,
c.272=233, c.268=88, c.274=36, c.90=21, c.267=14, c.140=6, c.127=6, c.6=2,
c.64C=2, c.267A=1. Total = 6334. "No statute code" = 0.

DOM (all nonzero `.chapter-row` entries, `.chapter-row-count`):

| Chapter | SQL | DOM | Match |
|---|---|---|---|
| c. 265 | 3,193 | 3,193 | yes |
| c. 269 | 1,298 | 1,298 | yes |
| c. 94C | 1,167 | 1,167 | yes |
| c. 266 | 267 | 267 | yes |
| c. 272 | 233 | 233 | yes |
| c. 268 | 88 | 88 | yes |
| c. 274 | 36 | 36 | yes |
| c. 90 | 21 | 21 | yes |
| c. 267 | 14 | 14 | yes |
| c. 127 | 6 | 6 | yes |
| c. 140 | 6 | 6 | yes |
| c. 6 | 2 | 2 | yes |
| c. 64C | 2 | 2 | yes |
| c. 267A | 1 | 1 | yes |

Sum of DOM nonzero rows = 6,334, matches header "6,334 of 200,630 charge
rows" and SQL total exactly. Confirms the chapter modal reflects both the
court filter and the applied severity filter (neither is chapter's own
column, so both apply per the cross-filter rule), while its own column
(statute_chapter) is correctly stripped from its own count basis.

## 5. Apply severity=Felony (only): chart/table totals, x = filed_under (DA), table chart

Cleared the court filter, kept `severity_class = Felony`, filings lens,
x-axis = Filed under (DA), chart type = Table.

SQL:
```sql
SELECT filed_under, COUNT(*) c FROM hayden
WHERE filed_in_window AND severity_class = 'Felony' GROUP BY 1 ORDER BY c DESC;
-- Hayden 46213, Rollins 355; total 46568
```

DOM table:

| Filed under | SQL count | DOM count | SQL share | DOM share | Match |
|---|---|---|---|---|---|
| Hayden | 46,213 | 46,213 | 99.19% | 99.2% | yes |
| Rollins | 355 | 355 | 0.76% | 0.8% | yes |
| Sum of rows | 46,568 | 46,568 | 100.0% | 100.0% | yes |

Header: "46,568 of 200,630 charge rows". Match.

## 6. History on: severity modal's "Not graded (pre-2022)" card

Turned on "Include 2006-2021" (history), cleared all filters.

Lens radio counts on load, all matching `hayden filed/disposed_in_window +
pre2022 filed/disposed_in_window` sums computed independently in SQL:

| Lens | SQL (hayden + pre2022) | DOM | Match |
|---|---|---|---|
| Filings | 161,134 + 874,107 = 1,035,241 | 1,035,241 | yes |
| Dispositions | 153,920 + 973,867 = 1,127,787 | 1,127,787 | yes |
| Both | 200,630 + 1,092,889 = 1,293,519 | 1,293,519 | yes |

### 6a. Both lens (`lens: 'all'`, `windowFlag: null` per `contract.ts` LENS_INFO — no window filter applies at all)

Expectation derived from the app's own lens semantics: since `all` lens has
no `windowFlag`, every row of both files counts unconditionally, so the
Not-graded card should equal the **full unfiltered pre2022 row count**
(1,092,889), not any windowed subset of it.

SQL: `SELECT COUNT(*) FROM pre2022` → 1,092,889. Also:
`SELECT severity_class, COUNT(*) FROM hayden GROUP BY 1` (no filter at all,
since Both lens has no window flag) → Felony 61,117 / Misdemeanor 116,607 /
Civil infraction 20,101 / Unclassified 2,805 (the whole-file distribution
already sanity-checked against the README above).

DOM (severity modal under Both lens, history on):

| Card | SQL | DOM | Match |
|---|---|---|---|
| Felony | 61,117 | 61,117 | yes |
| Misdemeanor | 116,607 | 116,607 | yes |
| Civil infraction | 20,101 | 20,101 | yes |
| Unclassified | 2,805 | 2,805 | yes |
| Not graded (pre-2022) | 1,092,889 | 1,092,889 | yes |

Sum = 1,293,519, matches the Both-lens header total exactly.

### 6b. Filings lens (`windowFlag: 'filed_in_window'`), history on

Expectation: Not-graded card = pre2022 rows with `filed_in_window = true`
only (874,107), and the four graded cards revert to the same
filed_in_window-restricted values as scenario 1.

SQL: `SELECT COUNT(*) FROM pre2022 WHERE filed_in_window` → 874,107.

DOM (switched lens radio to Filings, same severity modal reopened):

| Card | SQL | DOM | Match |
|---|---|---|---|
| Felony | 46,568 | 46,568 | yes |
| Misdemeanor | 94,918 | 94,918 | yes |
| Civil infraction | 17,553 | 17,553 | yes |
| Unclassified | 2,095 | 2,095 | yes |
| Not graded (pre-2022) | 874,107 | 874,107 | yes |

No discrepancy in either lens state. The Not-graded card correctly tracks
the active lens's window semantics rather than showing a lens-independent
constant.

## 7. Three additional adversarial scenarios (invented)

### 7A. Severity x DTP decline list (real cross-column filter)

Applied `dtp_class = 'YY (decline list)'` as a real filter (filings lens, no
history), then opened the severity modal.

SQL:
```sql
SELECT severity_class, COUNT(*) c FROM hayden
WHERE filed_in_window AND dtp_class = 'YY (decline list)' GROUP BY 1 ORDER BY c DESC;
-- Misdemeanor 34430, Felony 4673, Unclassified 3; total 39106
```
(39,106 independently matches the assembled README's own stated count of
"39,106 dtp_class-YY filed charges" — a second, unrelated cross-check.)

DOM:

| Card | SQL | DOM | Match |
|---|---|---|---|
| Felony | 4,673 | 4,673 | yes |
| Misdemeanor | 34,430 | 34,430 | yes |
| Civil infraction | 0 | 0 | yes |
| Unclassified | 3 | 3 | yes |

Header: "39,106 of 200,630 charge rows". Match.

### 7B. Chapter c. 269 crossed with a specific year (date-range filter interacting with a real chapter filter)

Applied `statute_chapter = 'c. 269'` plus `dateFrom = 2023-01-01`,
`dateTo = 2023-12-31` (filings lens).

SQL:
```sql
SELECT COUNT(*) FROM hayden
WHERE filed_in_window AND statute_chapter_calc = 'c. 269'
  AND filing_date BETWEEN '2023-01-01' AND '2023-12-31';
-- 2883
```
Monthly breakdown also pulled and compared against the app's own data-table
disclosure (`Show data table (12 rows)`):

| Month | SQL | DOM | Match |
|---|---|---|---|
| 2023-01 | 182 | 182 | yes |
| 2023-02 | 145 | 145 | yes |
| 2023-03 | 392 | 392 | yes |
| 2023-04 | 148 | 148 | yes |
| 2023-05 | 282 | 282 | yes |
| 2023-06 | 287 | 287 | yes |
| 2023-07 | 240 | 240 | yes |
| 2023-08 | 247 | 247 | yes |
| 2023-09 | 297 | 297 | yes |
| 2023-10 | 269 | 269 | yes |
| 2023-11 | 195 | 195 | yes |
| 2023-12 | 199 | 199 | yes |
| Sum | 2,883 | 2,883 | yes |

Header: "2,883 of 200,630 charge rows". Match. This exercises the
`fromDay`/`toDay` date-range gate combined with a real chapter filter and a
12-bucket time axis; all 12 monthly buckets and the sum matched.

### 7C. % mode with severity as series, `pctDenom: 'lens'` (per-x baseline ignoring ALL filters)

This is the least-exercised code path: `view.pct=true`,
`view.pctDenom='lens'`, x=Court, series=Severity, chart=Table, with the
`dtp_class='YY (decline list)'` filter still active. Per `aggregate.ts`,
the "Share" denominator for `pctDenom==='lens'` is the **unfiltered**
per-x count (lens window + date range only, no value filters at all) —
deliberately different from the numerator, which is fully filtered.

SQL (numerator — filtered view, court x severity):
```sql
SELECT court, severity_class, COUNT(*) c FROM hayden
WHERE filed_in_window AND dtp_class = 'YY (decline list)' GROUP BY 1,2;
```
SQL (denominator — xBaseline per court, filed_in_window only, no dtp_class filter):
```sql
SELECT court, COUNT(*) c FROM hayden WHERE filed_in_window GROUP BY 1;
-- Boston Municipal Court 35635, Brighton 6799, Charlestown 4230, Chelsea 24769,
-- Dorchester 30741, East Boston 9363, Roxbury 23345, South Boston 7891,
-- Suffolk Superior 8846, West Roxbury 9515 (sums to 161134, the full filings total)
```

DOM table (`.tablewrap table`, all 20 data rows + sum):

| Court | Severity | SQL count | DOM count | SQL share | DOM share | Match |
|---|---|---|---|---|---|---|
| Boston Municipal Court | Felony | 1,633 | 1,633 | 4.58% | 4.6% | yes |
| Boston Municipal Court | Misdemeanor | 11,442 | 11,442 | 32.11% | 32.1% | yes |
| Roxbury Court | Felony | 1,032 | 1,032 | 4.42% | 4.4% | yes |
| Roxbury Court | Misdemeanor | 5,786 | 5,786 | 24.78% | 24.8% | yes |
| Roxbury Court | Unclassified | 3 | 3 | 0.013% | 0.0% | yes |
| Dorchester Court | Felony | 588 | 588 | 1.91% | 1.9% | yes |
| Dorchester Court | Misdemeanor | 5,560 | 5,560 | 18.09% | 18.1% | yes |
| Chelsea Court | Felony | 211 | 211 | 0.85% | 0.9% | yes |
| Chelsea Court | Misdemeanor | 3,672 | 3,672 | 14.83% | 14.8% | yes |
| East Boston Court | Felony | 229 | 229 | 2.45% | 2.4% | yes |
| East Boston Court | Misdemeanor | 1,986 | 1,986 | 21.21% | 21.2% | yes |
| South Boston Court | Felony | 159 | 159 | 2.01% | 2.0% | yes |
| South Boston Court | Misdemeanor | 2,054 | 2,054 | 26.03% | 26.0% | yes |
| West Roxbury Court | Felony | 199 | 199 | 2.09% | 2.1% | yes |
| West Roxbury Court | Misdemeanor | 1,660 | 1,660 | 17.45% | 17.4% | yes |
| Brighton Court | Felony | 89 | 89 | 1.31% | 1.3% | yes |
| Brighton Court | Misdemeanor | 1,392 | 1,392 | 20.47% | 20.5% | yes |
| Charlestown Court | Felony | 37 | 37 | 0.87% | 0.9% | yes |
| Charlestown Court | Misdemeanor | 726 | 726 | 17.16% | 17.2% | yes |
| Suffolk Superior Court | Felony | 496 | 496 | 5.61% | 5.6% | yes |
| Suffolk Superior Court | Misdemeanor | 152 | 152 | 1.72% | 1.7% | yes |
| **Sum of rows** | | 39,106 | 39,106 | 24.27%* | 24.3% | yes |

\* Sum-of-rows share = 39,106 / (sum of all 10 court baselines = 161,134) =
24.27%, which is a *different* formula from summing the per-row shares
(the footer uses `sum(values) / sum(xBaseline)`, not `sum(share%)`); the app
computes it that way too (`AggTable.tsx` line ~155), and the result matches.

All 20 filtered counts, all 20 per-cell shares, and the footer sum/share
match to the displayed decimal. Header: "39,106 of 200,630 charge rows".

## 8. Dispositions lens variant of scenario 1

Filings lens replaced with Dispositions lens, history off, all filters
cleared.

SQL:
```sql
SELECT severity_class, COUNT(*) c FROM hayden
WHERE disposed_in_window GROUP BY 1 ORDER BY c DESC;
-- Misdemeanor 90492, Felony 44393, Civil infraction 16770, Unclassified 2265
-- total 153920
```

DOM:

| Card | SQL | DOM | Match |
|---|---|---|---|
| Felony | 44,393 | 44,393 | yes |
| Misdemeanor | 90,492 | 90,492 | yes |
| Civil infraction | 16,770 | 16,770 | yes |
| Unclassified | 2,265 | 2,265 | yes |

Header: "153,920 of 200,630 charge rows" == the Dispositions lens radio
count shown at page load. Match.

## Bonus cross-check (not one of the 3 invented scenarios, found opportunistically)

While in the Both-lens/history-on state for scenario 6a, the x=filed_under
table (still active from an earlier step) showed Conley 967,989 (74.8%),
Rollins 165,485 (12.8%), Hayden 160,036 (12.4%), Martin 9 (0.0%), sum
1,293,519. Independently verified:
```sql
SELECT filed_under, COUNT(*) c FROM (
  SELECT filed_under FROM hayden UNION ALL SELECT filed_under FROM pre2022
) GROUP BY 1 ORDER BY c DESC;
-- Conley 967989, Rollins 165485, Hayden 160036, Martin 9
```
Exact match, all four rows.

---

## Summary

- **Comparisons made:** 8 required scenarios + 3 invented scenarios + 1
  opportunistic bonus check = 12 scenario groups, comprising roughly 140
  individual numeric comparisons (card counts, chapter-row counts, table
  cells, percentage shares, header totals, and lens-radio counts).
- **Matched:** all of them.
- **Mismatched:** none.
- **UI numbers that could not be located:** none; every requested card,
  row, table cell, and percentage was found in the live DOM by selector
  (`.dtp-card`, `.chapter-row`, `.tablewrap table`, `[role=status]`) and
  read directly, not inferred from a screenshot or prior report.

No defects found in the severity/chapter filter numbers on this branch
across default views, cross-filtering (severity's own column stripped while
other filters apply, and vice versa for chapter), the history toggle's
interaction with each lens's window-flag semantics, date-range filtering,
DTP-list cross-filtering, and the `pctDenom: 'lens'` per-x-baseline
percentage path with a series dimension active.
