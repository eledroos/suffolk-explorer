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

## Content verification (Task 6)

Every factual number and claim in `DTP_CONTENT`, `DTP_HEADER`, and `DTP_CAVEAT`
(`src/ui/dtpModel.ts`) was re-derived from primary sources, independent of the
prior scenario-count work above.

**Method.** Two sources, matched to what each claim is actually about:

- **Workbook counts (46 / 76 / 107 / 17).** These describe the classification
  workbook itself, not the assembled data, so they were checked against the
  workbook directly:
  `data/suffolk-package/reference/SCDAO-DTP-Classification.xlsx` (the `DTPWB`
  constant in `data/assembled/build_pre2022.py`), `YY REVIEW` tab. A scratch
  script (`uv venv && uv pip install duckdb openpyxl` in
  `/tmp/dtp-content`) reimplemented `load_review()` line for line, in the
  same order (section-header detection, `norm_ws` + `.upper()` normalization,
  the `exact` dict keyed by normalized string with `current > agreed >
  disagreed` precedence, then the 75-char `prefix` fallback), and printed the
  distinct-string count that lands under each label. It also printed the raw
  per-section row counts before dedup, and cross-checked for duplicate
  strings within and across sections.
- **Data counts (2,393 / about 1%).** These describe the assembled dataset, so
  they were checked with duckdb directly against
  `public/data/hayden.parquet`, the file the running app reads, using the
  exact query given in the task brief for the first and the equivalent share
  computation for the second.
- **"In 2019 the Rollins administration published a list."** Checked against
  the primary document itself, not a secondary description: `The Rachael
  Rollins Policy Memo.pdf` in
  `data/suffolk-package/data/wadadam/Suffolk First Production/`. Its cover
  page reads "MARCH 2019" and the internal "Message from the DA" is dated
  "March 25, 2019." `notes.md` and `data/assembled/README.md` were also
  checked per the task brief; neither carries a memo date beyond Rollins's
  January 2, 2019 swearing-in, so the PDF itself is the primary source of
  record for the year.

**Workbook re-derivation, raw output:**

```
Section headers found: {'Current list': 'DTP CURRENT CHARGES (46)',
  'Proposed, agreed (never adopted)': 'DTP PROPOSED NEW CHARGES AGREED (76 new)',
  'Proposed, disagreed': 'DTP PROPOSED NEW CHARGES DISAGREE (17)'}
Raw row counts per section (before dedup): Current list 46, Proposed agreed 107, Proposed disagreed 17
Distinct normalized strings per label, after load_review()'s precedence collapse:
  Current list 46, Proposed, agreed (never adopted) 107, Proposed, disagreed 16
75-char-prefix fallback: no further collisions (still 46 / 107 / 16)

Overlap check (raw section membership):
  disagreed strings also in current: {'METHAMPHETAMINE, POSSESS TO DISTRIB C94C §32A(C)'}
  disagreed strings also in agreed: set()
  current strings also in agreed: set()
  no duplicate strings within any single section
```

One disagreed-section string ("METHAMPHETAMINE, POSSESS TO DISTRIB c94C
§32A(c)") is byte-for-byte identical, after whitespace normalization, to a
string already on the current list (row 27 of the `YY REVIEW` tab). Because
`load_review()`'s precedence is current > agreed > disagreed, that string is
filed under `Current list` in the `exact` dict, not `Proposed, disagreed`.
The workbook's own section header still says "(17)" and the raw section
still lists 17 rows, but the number of distinct description strings that
`review_of()` can ever actually label `Proposed, disagreed` in production
data is 16. This is the same fact `dtpModel.ts`'s "Current list" card already
states in different words ("Where one description also appears in a rejected
proposal, the operative list wins."); the "Proposed, disagreed" card's count
just hadn't been adjusted for it.

**Data query output (duckdb against `public/data/hayden.parquet`):**

```sql
SELECT count(*) FROM read_parquet('public/data/hayden.parquet')
WHERE filed_in_window AND dtp_class LIKE 'YY%' AND dtp_review='Proposed, disagreed';
-- 2393

SELECT
  sum(CASE WHEN dtp_class = 'Not listed' THEN 1 ELSE 0 END) AS not_listed,
  count(*) AS total
FROM read_parquet('public/data/hayden.parquet');
-- 2124 / 200630 = 1.06% (all rows)

SELECT
  sum(CASE WHEN dtp_class = 'Not listed' THEN 1 ELSE 0 END) AS not_listed,
  count(*) AS total
FROM read_parquet('public/data/hayden.parquet') WHERE filed_in_window;
-- 1876 / 161134 = 1.16% (filed_in_window only)
```

Both denominators round to "about 1%"; the all-rows figure also matches the
data README's "Not listed 2,124 (1.1%)" line exactly.

**Claim → source → verified value:**

| # | Claim in `dtpModel.ts` | Source | Method | Verified value | Verdict |
|---|---|---|---|---|---|
| 1 | "46 charge descriptions" on the current list (appears twice: `dtp_class` YY card and `dtp_review` Current list card) | `SCDAO-DTP-Classification.xlsx`, `YY REVIEW` tab, "DTP CURRENT CHARGES (46)" section | Mirrored `load_review()`: distinct normalized strings labeled `Current list` in the precedence-resolved `exact` dict | 46 | **PASS** — no change |
| 2 | "76 charges" in the agreed expansion | Same tab, "DTP PROPOSED NEW CHARGES AGREED (76 new)" section header | Literal header text in the workbook (this is the working group's own base-charge count, not a row count) | 76 | **PASS** — no change |
| 3 | "107 statute-variant strings" for the agreed expansion | Same section, row body | Raw row count = distinct normalized strings labeled `Proposed, agreed (never adopted)` (no cross-section overlap with current or disagreed) | 107 | **PASS** — no change |
| 4 | "17" description strings, disagreed | Same tab, "DTP PROPOSED NEW CHARGES DISAGREE (17)" section | Raw section has 17 rows/17 distinct strings, but one ("METHAMPHETAMINE, POSSESS TO DISTRIB c94C §32A(c)") also sits on the current list; `current > agreed > disagreed` precedence reassigns it, so only 16 strings actually carry the `Proposed, disagreed` label | **16** | **FAIL → FIXED.** Changed `17` to `16` in the `Proposed, disagreed` card's detail text (`src/ui/dtpModel.ts`). See README discrepancy note below. |
| 5 | "2,393 charges filed 2022–2025" carry the YY tag with a review-disagreed description | `public/data/hayden.parquet` | `SELECT count(*) ... WHERE filed_in_window AND dtp_class LIKE 'YY%' AND dtp_review='Proposed, disagreed'` | 2,393 | **PASS** — no change |
| 6 | "about 1%" Not listed | `public/data/hayden.parquet` | Share of `dtp_class = 'Not listed'`, all rows and filed_in_window-only, both computed | 1.06% (all rows) / 1.16% (filed_in_window) | **PASS** — both round to "about 1%"; no change |
| 7 | "In 2019 the Rollins administration published a list" | `The Rachael Rollins Policy Memo.pdf`, `data/suffolk-package/data/wadadam/Suffolk First Production/` | Read the PDF's cover page and dated cover letter directly | Cover: "MARCH 2019"; letter dated "March 25, 2019" | **PASS** — 2019 confirmed; no change |

**README discrepancy.** `data/assembled/README.md` (line 60, the `dtp_review`
column description) states `'Proposed, disagreed' (17)`, carrying the same
raw-section-count reading that `dtpModel.ts` had. Per the task brief's
constraints, only `src/ui/dtpModel.ts` and this results file were changed;
`README.md` was left untouched but this discrepancy should be corrected
there too in a future session, since it feeds the same wrong number into the
data documentation that the UI copy was just fixed to avoid.

**Copy change.** One sentence changed in `src/ui/dtpModel.ts`, the
`Proposed, disagreed` card under `dtp_review`:

```diff
- '17 description strings. Some of these still carry the on-the-list ' +
+ '16 description strings. Some of these still carry the on-the-list ' +
```

`npm run test` (62/62 passing, including the 17 `dtpModel.test.ts` content
tests) and `npm run build` both pass after the change.
