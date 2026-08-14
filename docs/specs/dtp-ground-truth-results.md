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

> **Superseded in part by Task 7.** The Task 7 fix wave rewrote the copy after
> the pass-2 content review. Rows 1, 2, 3, 5 and 7 below still describe
> sentences in the shipped copy. Row 4's fix stands and is restated with more
> detail in the Task 7 table. Row 6's "about 1%" was scoped to a named file and
> a second share added, see Task 7 row 12. Every claim the rewrite introduced is
> verified in the Task 7 table below, not here.

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

## Content verification (Task 7 rewrite)

The pass-2 adversarial content review
(`.superpowers/sdd/2026-08-12-dtp-filter-modal/pass2-content.md`) found 3
Critical, 7 Important and 5 Minor content defects. It did not dispute a Task 6
number. What it found is that the copy attributed the classification's contents
to the office as current practice, described the `dtp_class` tag as the
operative 46-string list when it is built from the worksheet's wider 69-string
YY tab, and credited a "working group" with acts the review tab does not
record. The Task 7 rewrite attributes every card to the classification and adds
the qualifications the sources carry.

**Method.** Same two-source discipline as Task 6, plus the memo PDF and the
worksheet's non-review tabs, which Task 6 never opened:

- **Worksheet counts (69 / 46 / 32 / 107 / 17 / reviewer columns).**
  `data/suffolk-package/reference/SCDAO-DTP-Classification.xlsx`, read with
  openpyxl in a scratch venv (`/tmp/dtp-fix`, `uv pip install duckdb openpyxl`).
  `load_dtp()` and `load_review()` from `data/assembled/build_pre2022.py` were
  mirrored line for line, including `norm_ws` + `.upper()` normalization, the
  `YY, NY, NS, NN` tab order with first-writer-wins, and the
  `current > agreed > disagreed` precedence.
- **Data shares (Not listed, NS three quarters, agreed-tier civil MV share,
  Superior Court YY).** duckdb against **both** `public/data/hayden.parquet`
  and `public/data/history.parquet`. Task 6 checked only the first; pass-2 I3
  was the finding that the modal renders over both.
- **Memo claims (15 offenses, the court scope limit).** `pdftotext` over `The
  Rachael Rollins Policy Memo.pdf` in
  `data/suffolk-package/data/wadadam/Suffolk First Production/`, reading
  Appendix C's own opening page.
- **Worksheet provenance.** `unzip -p ... docProps/core.xml`, the standing rule
  in CLAUDE.md.

**Claim → source → verified value:**

| # | Claim in the shipped copy | Source | Method | Verified value | Verdict |
|---|---|---|---|---|---|
| 1 | "a worksheet created inside the District Attorney's office in 2020" (header detail) | `SCDAO-DTP-Classification.xlsx`, `docProps/core.xml` | `unzip -p` | `dc:creator` = `Constantino, Bobby (SUF)`, `created` = 2020-08-11, `modified` = 2020-11-24. The `(SUF)` suffix is the SCDAO account convention on this delivery | **PASS.** Copy names no individual, per ruling R3 |
| 2 | "circulated to four reviewers and carries one reviewer's responses" (header detail) | `YY REVIEW` tab, reviewer columns | Counted filled cells under each initialled column across all three sections | RR 0, **DSP 139**, LR 0, MT 0. Four columns, one respondent | **PASS.** Replaces the unsupported "a working group agreed" (pass-2 I1) |
| 3 | **69** charge-description strings on the YY tab (YY card detail) | `YY` tab | Mirrored `load_dtp()`: distinct normalized non-header strings the tab contributes | **69** (per-tab: YY 69, NY 107, NS 627, NN 497; 1,300 total) | **PASS.** New number (pass-2 C1) |
| 4 | The YY tab "is broader than the operative 46-string list" (YY card detail) | `YY` tab vs `YY REVIEW` "DTP CURRENT CHARGES (46)" | Set comparison after normalization | All 46 are a strict subset of the 69; **23 extras** | **PASS.** New claim (pass-2 C1) |
| 5 | The YY tab "includes drug distribution charges the worksheet's own annotations say were not in the memo" (YY card detail) | `YY` tab, annotation column | Read the annotation on each of the 23 extras | 10 of the 23 are distribution charges annotated `NOT IN MEMO AND WOULD NOT ADD` (cocaine, oxycodone, methamphetamine, drug classes A through E); an 11th reads "PWID in memo and agree, Distribution not in memo and would not add at this time" | **PASS.** Copy asserts no count, only the fact (ruling R1) |
| 6 | **46** charge descriptions on the operative list (Current list card) | `YY REVIEW`, "DTP CURRENT CHARGES (46)" | Mirrored `load_review()` precedence-resolved `exact` dict | 46 | **PASS.** Carried from Task 6 row 1 |
| 7 | "The memo lists **15** offenses" (Current list card) | `The Rachael Rollins Policy Memo.pdf`, Appendix C page C-1 | `pdftotext`, read the sentence | Verbatim: "The list of 15 offenses identified for declination and diversion are included in the chart beginning on page C-3" | **PASS.** New number (pass-2 M2) |
| 8 | "The memo's own text limits the policy to the municipal courts and Chelsea District Court" (YY card detail) | Same PDF, Appendix C page C-1, first line | `pdftotext`, read the sentence | Verbatim: "At this time, this policy relates only to charges that will remain in a Division of the Boston Municipal Court, and Chelsea District Court." | **PASS.** New claim (pass-2 I6) |
| 9 | "charges filed in Suffolk Superior Court carry the tag by charge type only" (YY card detail) | `public/data/hayden.parquet` | `WHERE dtp_class LIKE 'YY%' AND lower(court) LIKE '%superior%'` | **879** all rows (648 `filed_in_window`). Existence confirmed; the copy prints no number, per ruling R6 | **PASS** |
| 10 | The NY tag covers charges "its author judged should fall under the memo's broader categories" (NY card detail) | `NY` tab, row 1 definition | Read the tab's own definition text | Verbatim: NY means the charge "is either envisioned in one of the broader categories in the DTP in Appendix D of The Rollins Memo, **or should be**" | **PASS.** New claim (pass-2 C2) |
| 11 | "The worksheet's own review disagrees with the case-by-case designation on rows covering about **three quarters** of these charges" (NS card detail) | `NS` tab reviewer columns + both parquets | Collected NS rows whose only reviewer entry is a bare `N` (the tab's own instruction: "you can also just put an (N) for disagree"), then summed charges whose description maps to those strings via `dtp_of()`'s exact-then-75-char rule | 404 distinct strings across 405 rows. **43,419 of 57,079 Hayden NS charges = 76.1%**; 269,955 of 380,079 pre-2022 NS charges = 71.0% | **PASS.** New claim (pass-2 C3). Pass 2 derived 76.0% / 71.1% independently; both support "about three quarters" |
| 12 | Not listed is "about **1%** of the charges in the 2022 to 2025 file and about **6%** of the charges in the pre-2022 file" (Not listed card detail) | Both parquets | Share of `dtp_class = 'Not listed'`, all rows in each file | hayden **2,124/200,630 = 1.06%**; history **63,555/1,092,889 = 5.82%** (matches `data/assembled/README.md`'s "Not listed 5.8%") | **PASS.** Replaces Task 6's unscoped "about 1% of charges", which understated by a factor of five with the history toggle on (pass-2 I3) |
| 13 | "**1,079** distinct unmatched descriptions", some "plainer spellings the worksheet does not carry" and others "charge types the worksheet does carry, written with a different statute citation" (Not listed card detail) | `history.parquet` + all four classification tabs | Counted distinct unmatched descriptions; then re-ran `dtp_of()` over them with one added normalization, rewriting the `c. 266 s. 127` citation style to the worksheet's `c266 §127` style, and measured how many charges that alone recovers | **1,079** distinct unmatched descriptions covering 63,108 charges with a non-empty description. Citation-style normalization alone recovers **16,022 of those charges (25.4%)** across 158 distinct strings. `TRESPASSING` (1,606) is a genuine gap: no bare `TRESPASSING` appears on any tab. `DESTRUCTION OF PROPERTY +$250, MALICIOUS c. 266 s. 127` (3,506, the largest unmatched string) is **not** a gap: the worksheet carries `DESTRUCTION OF PROPERTY +$250, MALICIOUS C266 §127` and classifies it NS | **REVISED.** See the correction note below |
| 14 | **76** further charges marked agreed, and "the worksheet records no adoption of the expansion" (Proposed and agreed card) | `YY REVIEW`, section header and the tab as a whole | Literal header text: "DTP PROPOSED NEW CHARGES AGREED (76 new)". For the second sentence, the test is what the worksheet contains: no cell, header or annotation anywhere in the tab records adoption | 76. No adoption record exists in the worksheet | **PASS.** Carried from Task 6 row 2. Attribution changed from "a working group agreed" to "a 2020 review inside the office marked" (pass-2 I1). The unsourced negative "the expansion never became policy" was removed from the visible sentence in the follow-up wave and replaced with the checkable statement about what the worksheet records |
| 15 | **107** statute-variant strings in the agreed tier (Proposed and agreed card) | Same section, row body | Raw row count = distinct normalized strings under the label | 107 | **PASS.** Carried from Task 6 row 3 |
| 16 | "**32** of the 107 are civil motor vehicle infractions, about **a third** of this tier's charge volume in the 2022 to 2025 file" (Proposed and agreed card) | Same section + `hayden.parquet` | Counted agreed-section rows whose description carries the tab's `*` civil-infraction marker, then summed their charges in the agreed tier | **32 of 107** (speeding, unregistered vehicle, tire tread depth, safety glass, state highway and Tobin Bridge violations). **8,622 of 28,482 filed 2022-2025 = 30.3%** (all rows: 9,800 of 32,498 = 30.2%) | **PASS.** New numbers (pass-2 I7). Matches `notes.md`'s "8,622 of 28,482" exactly. The share is scoped to the named file in the copy because the pre-2022 figure is 26.8%, which "about a third" would overstate |
| 17 | **16** description strings, "after the operative list takes precedence over the section's **17** raw rows" (Proposed, rejected card) | `YY REVIEW`, "DTP PROPOSED NEW CHARGES DISAGREE (17)" | Mirrored `load_review()`'s `current > agreed > disagreed` precedence | 17 raw rows; `METHAMPHETAMINE, POSSESS TO DISTRIB c94C §32A(c)` is also on the current list and loses to it, leaving **16** reachable | **PASS.** Restates Task 6 row 4's fix and now shows its arithmetic in the copy |
| 18 | "**Three** of those rows record a deferral for consultation with the Human Trafficking Unit rather than a no, and **one** row agrees on possession with intent while refusing distribution" (Proposed, rejected card) | Same section, annotation column | Read all 17 rows' annotations | Three read `HTU needs to be consulted` (NIGHTWALKER, COMMON; NIGHTWALKER, COMMON, 3RD OFFENSE; STREETWALKER, COMMON). One reads "PWID in memo and agree, Distribution not in memo and would not add at this time" | **PASS.** New claim (pass-2 I2). Replaces "the working group said no", which was wrong for four of seventeen rows |
| 19 | "Classified NN in the worksheet: not cited in the memo, and judged not to belong in the declination policy" (Ordinarily prosecuted card) | `NN` tab, row 1 definition | Read the tab's own definition text | Verbatim: NN means "'No' the charge statute is not cited specifically in the DTP policy in Appendix C of The Rollins Memo, and 'No' the charge should not be considered for declination or diversion" | **PASS.** New claim, replaces "the office ordinarily prosecutes" (pass-2 I5) |
| 20 | "**2,393** charges filed 2022 to 2025" carry the YY tag on a disagreed description (YY card detail) | `hayden.parquet` | `WHERE filed_in_window AND dtp_class LIKE 'YY%' AND dtp_review='Proposed, disagreed'` | 2,393 | **PASS.** Carried from Task 6 row 5; only the en dash in the year range changed |
| 21 | "In 2019 the Rollins administration published a list" (header) | `The Rachael Rollins Policy Memo.pdf` | Cover page and dated cover letter | Cover "MARCH 2019"; letter dated March 25, 2019 | **PASS.** Carried from Task 6 row 7; sentence survived the adversarial pass unchanged |

**Correction to row 13, and one deviation from the re-review's specified text.**
The first Task 7 wave asserted that the pre-2022 share runs higher *because* the
older deliveries use "a plainer description format". The content re-review
(NB1) was right that the word "because" fails: ranked by volume, five of the top
eight unmatched pre-2022 descriptions are fully statute-cited, and `TRESPASSING`
is fifth rather than first. The first wave verified that claim on a selective
reading and it is corrected here.

The re-review's replacement sentence was applied for its first two clauses,
which reproduce exactly (1,079 distinct unmatched descriptions; `TRESPASSING`
unmatched at 1,606 against the worksheet's `TRESPASS c. 266 s. 120`, with no
bare `TRESPASSING` on any tab). Its third clause, "Others are charge types the
worksheet never covered, such as destruction of property over $250", **does not
survive verification and was not shipped.** The worksheet does carry that charge
type:

```
history.parquet, largest unmatched string:
  DESTRUCTION OF PROPERTY +$250, MALICIOUS c. 266 s. 127   3,506 charges
worksheet, NS tab:
  DESTRUCTION OF PROPERTY +$250, MALICIOUS C266 §127       classified NS
```

The two strings are the same charge type in two statute-citation styles. Both
are under 75 characters, so the prefix fallback cannot bridge them and the match
fails on citation format alone. Rewriting only that citation style and re-running
`dtp_of()` recovers **16,022 of 63,108 unmatched pre-2022 charges (25.4%)**
across 158 distinct strings, including the 3,506-charge string above, plus
`KIDNAPPING c. 265 s. 26` (460) and `LEAVE SCENE OF PERSONAL INJURY c. 90 s.
24(2)(a½)(1)` (353).

The shipped sentence therefore names both causes and uses the verified example
for the second: charge types the worksheet does carry, written with a different
statute citation. Shipping the re-review's text verbatim would have replaced one
unverified causal claim with another, on an example that contradicts itself.

**Style.** Every em dash and en dash was removed from the module, per CLAUDE.md's
absolute rule (pass-2 M3): the en-dashed year range became `2022 to 2025`, and
the two em dashes in the `Proposed, rejected` and `Not reviewed` cards became
sentence breaks. `grep` for the full dash range over `src/ui/dtpModel.ts` returns
nothing.

**Visibility.** `DtpFilterModal.tsx` renders every `detail` array inside a
collapsed `<details>`, so a screenshot publishes only `DTP_HEADER.plain`, each
card's `plain` sentence, and `DTP_CAVEAT`. The two corrections that most needed
to be visible were placed accordingly: every card's `plain` now names the
classification rather than the office, and `DTP_CAVEAT` gained the YY-tab
sentence so the 69-versus-46 distinction is not buried.

`npm run test` (62/62, including the 17 `dtpModel.test.ts` content tests, whose
`plain.length > 20` assertion every rewritten sentence satisfies) and
`npm run build` both pass after the rewrite.

## Content relocation (v2 Task 2)

`src/ui/dtpModel.ts`'s `DtpCard.detail` changed shape from `string[]` to
`{paragraphs: string[]; facts: {label; value}[]; links?}` per
`docs/specs/2026-08-13-dtp-modal-v2-design.md`'s "Card redesign" and "Content
shape change" sections. No claim in the Task 6/7 table above changed. The
task brief's chip assignments moved eleven load-bearing numbers out of prose
paragraphs and into `facts` chips, shortening the paragraphs that carried
them. This section records where each Task 7 claim now lives. Rows not
listed in the table below (1, 2, 5, 8, 9, 10, 11, 13, 18, 19, 21) kept their
sentence and paragraph position; they were only rewrapped into the new
`paragraphs` array, and no character of their text changed.

| Task 7 # | Claim | Now lives in |
|---|---|---|
| 3 | 69 charge-description strings on the YY tab | Chip "Worksheet YY strings" = 69, `dtp_class` YY card (relabeled from "Charge descriptions" in the fix wave below, ruling R4) |
| 4 | YY tab "is broader than the operative 46-string list" | The relationship ("broader than the operative list shown under Review status"): `dtp_class` YY card, paragraph 1, number removed and the sentence reflowed. The 46 figure itself: chip "Operative list strings" = 46, same card (relabeled from "Operative list", ruling R5) |
| 6 | 46 charge descriptions on the operative list | Chip "Operative list strings" = 46, `dtp_review` Current list card (relabeled from "Operative charge descriptions", ruling R5, so both cards name the same quantity the same way) |
| 7 | "The memo lists 15 offenses" | Chip "Memo offenses" = 15, `dtp_review` Current list card |
| 12 | Not listed "about 1%" of the 2022-2025 file, "about 6%" of the pre-2022 file | Chips "Share of the 2022-2025 file" = about 1% and "Share of the pre-2022 file" = about 6%, `dtp_class` Not listed card. The Task 2 labels ("Share of 2022-2025 charges", "Share of 2006-2021 charges") restated a file-scoped share as a date-scoped one and were wrong under the new scope; ruling R1 restored the file scope this row's verified values were computed under. See C1 in the fix wave below. Both numbers were the entire content of the sentence that carried them; that sentence's second half, "Mostly truncated or rare description variants that failed the match even with the 75-character fallback," is now the card's paragraph 1 on its own |
| 14 | 76 further charges agreed; "the worksheet records no adoption of the expansion" | The "worksheet records no adoption" sentence stays in the card's `plain` field; Task 2 left `plain` untouched. The "76 further charges" part dropped the "76" in Task 3 (see Ledger carry-item C, line 778): plain now reads "A 2020 review inside the office marked further charges agreed for declination." The 76 figure is additionally surfaced as chip "Descriptions marked agreed" = 76, `dtp_review` Proposed-and-agreed card, so a reader who only opens the structured detail still sees it (relabeled from "Charges marked agreed" because "charges" counts rows everywhere else in this UI, then from "Charge types" because the 107 rows yield no 76 under any distinct-string derivation; see NB1 in the re-review round below) |
| 15 | 107 statute-variant strings | Chip "Statute-variant strings" = 107, `dtp_review` Proposed-and-agreed card. Paragraph 1 of that card now reads "The agreed expansion covers statute-variant description strings" without the number |
| 16 | "32 of the 107 are civil motor vehicle infractions, about a third" of 2022-2025 tier volume | Chip "Civil motor vehicle strings" = 32, same card. Paragraph 1 keeps "Some of these are civil motor vehicle infractions, about a third of this tier's charge volume in the 2022 to 2025 file"; "32 of the 107" became "Some of these" since both counts moved to chips |
| 17 | "16 description strings, after the operative list takes precedence over the section's 17 raw rows" | Chips "Strings left after precedence" = 16 and "Review rows" = 17, `dtp_review` Proposed-disagreed (Rejected) card (relabeled from "Raw rows" and "Strings after precedence", ruling R6; R6's "Distinct strings" for the 16 was then corrected back, since all 17 raw rows are distinct strings and the 16 is what precedence leaves. See NB2 in the re-review round below). Paragraph 1 keeps the precedence relationship, "these description strings are what remains after the operative list takes precedence over the section's raw rows," without either number |
| 20 | 2,393 charges filed 2022-2025 carry the YY tag on a disagreed description | `dtp_class` YY card, paragraph 3. Task 3 rewrote the citation tail (see Ledger carry-item B, lines 755-761): moved from "the worksheet itself contains that conflict; a ruling is pending" to "That conflict is in the source classification. The Browse tab flags the conflicting rows." The 2,393 figure itself is unchanged; the sentence's content and direction shifted from unreachable documentation to UI navigation. Not chipped; the brief's chip list does not include this figure |

**DTP_CAVEAT.** Per the task brief's Step 2, the constant's shape changed to
`{text, conflictLinkLabel}`. Its last sentence, "The conflict is documented in
the data README and a ruling on it is pending," was removed rather than
relocated: it cited a document (`data/assembled/README.md`) a reader of the
deployed site cannot reach, per the design spec's "Links" section. Every
other sentence in the caveat is unchanged and present verbatim in
`DTP_CAVEAT.text`. `conflictLinkLabel: "See the conflicting rows"` replaces
the removed sentence's function; Task 3 wires the label to a link that
switches the modal to the browse tab with the conflict filter active.

**Spec correction carried forward.** Task 1 found that the design spec's "the
16" conflict-string figure for the Browse tab's Conflicts chip does not match
a distinct fact from the Rejected-tier chips added here: the Rejected card's
chips ("Raw rows" = 17, "Strings after precedence" = 16) describe the size of
the whole `Proposed, disagreed` review tier, not the narrower YY-intersected
conflict set (10 strings; see this document's "The '16' in the design spec
does not survive recomputation" section below). Both chips are about the
tier, as the task brief specifies, and are unaffected by that correction. The
Rejected card's second paragraph, "Some of these strings still carry the
on-the-list tag in the other grouping," makes no numeric claim about the
overlap and needed no change to stay consistent with the corrected count of
10.

**Verification.** `npm run test` (68/68; `dtpModel.test.ts` grew from 18 to 23
tests, adding fact-chip shape assertions, a `DTP_HEADER`/`DTP_CAVEAT`/
`MEMO_URL` shape check, and a test that no paragraph repeats one of its own
card's chip numbers, matched on digit runs so a chip's "76" cannot falsely
collide with a paragraph's "2,076") and `npm run build` both pass. The interim
`src/ui/DtpFilterModal.tsx` (Task 3's file per the plan, not Task 2's) needed
four edits to keep compiling against the new `DtpDetail` shape:
`.detail.paragraphs` in place of `.detail` at the header and card levels, and
`DTP_CAVEAT.text` in place of `DTP_CAVEAT`. It does not yet render fact
chips, links, or the caveat's conflict link; that UI work is Task 3's, per
the plan's file ownership.

## dtp-lists reconciliation (v2 Task 1)

`scripts/prepare_dtp_lists.py` builds `public/data/dtp-lists.json` and
`public/downloads/suffolk-dtp-lists.xlsx`, the browse/download assets for the
v2 modal's third tab. It mirrors `../assembled/build_pre2022.py`'s `norm_ws`,
`load_dtp`, and `load_review` (including `current > agreed > disagreed`
precedence) line for line, reading the same
`SCDAO-DTP-Classification.xlsx` workbook and the same two parquets
(`public/data/hayden.parquet`, filed_in_window 2022-2025; `public/data/
history.parquet`, filed_in_window 2006-2021). Run in a scratch venv
(`cd /tmp && mkdir -p dtp-v2 && cd dtp-v2 && uv venv && uv pip install duckdb
openpyxl`).

**Method for per-string counts.** The build's `dtp_of()` only returns a class
label, not which workbook string matched, so this script extends `load_dtp()`
to also track each workbook string's original-case display text and its
first-wins insertion order, then builds a 75-char-prefix index over that
same order (`build_prefix_map`) so any raw `charge_description` in either
parquet, matched exact-then-75-char-prefix exactly as the build does, can be
attributed to exactly one workbook string. Summing those per-string counts by
class must reproduce the parquet's own `dtp_class` group-by totals; that
equality is the main reconciliation gate.

### Gate output, verbatim

```
reading workbook: /Users/nasser/_dev/nasser-blog-posts/2026-08-03 Suffolk DA/data/suffolk-package/reference/SCDAO-DTP-Classification.xlsx
class-tab strings: {'YY': 69, 'NY': 107, 'NS': 627, 'NN': 497} = 1300 total (first-wins across tabs, so this can be < the sum if any string repeats across tabs)
[PASS] YY tab holds 69 strings -- got 69
review-tab exact dict, distinct strings by label (independent of the class tabs): {'Current list': 46, 'Proposed, agreed (never adopted)': 107, 'Proposed, disagreed': 16}
[PASS] review tab: 46 current / 107 agreed / 16 disagreed-after-precedence -- got {'Current list': 46, 'Proposed, agreed (never adopted)': 107, 'Proposed, disagreed': 16}
[PASS] no 75-char-prefix collisions among workbook class-tab strings (first-wins would apply if any existed) -- collision count = 0
hayden: 159,258 charges attributed to a workbook string, 1,876 unmatched (Not listed)
history: 855,150 charges attributed to a workbook string, 18,957 unmatched (Not listed)
[PASS] hayden YY (decline list): sum of per-string n_2022_2025 == parquet class total -- sum=39,106 parquet=39,106
[PASS] hayden NY (presumption against): sum of per-string n_2022_2025 == parquet class total -- sum=30,563 parquet=30,563
[PASS] hayden NS (case-by-case): sum of per-string n_2022_2025 == parquet class total -- sum=45,088 parquet=45,088
[PASS] hayden NN (prosecute): sum of per-string n_2022_2025 == parquet class total -- sum=44,501 parquet=44,501
[PASS] history YY (decline list): sum of per-string n_2006_2021 == parquet class total -- sum=221,881 parquet=221,881
[PASS] history NY (presumption against): sum of per-string n_2006_2021 == parquet class total -- sum=139,974 parquet=139,974
[PASS] history NS (case-by-case): sum of per-string n_2006_2021 == parquet class total -- sum=301,878 parquet=301,878
[PASS] history NN (prosecute): sum of per-string n_2006_2021 == parquet class total -- sum=191,417 parquet=191,417
[PASS] JSON rows: review-tier tally matches the independent workbook count (every review-tab string found a home among the class-tab strings) -- got {'Current list': 46, 'Proposed, disagreed': 16, 'Proposed, agreed (never adopted)': 107}
[PASS] conflict rows: JSON string count == hayden cross-tab distinct-string count -- JSON=10 parquet cross-tab=10
[PASS] conflict rows: charge-level count == 2,393 on record -- got 2,393
NOTE: the design spec and task brief say conflict rows number 16 (the full disagreed-tier count). The recomputed, internally-consistent value is 10: of the 16 disagreed-tier strings, only 10 are ALSO class YY (the other 6 are NY or NS in the class tabs, since 'disagreed' describes a proposal to change a charge's class, not its current one). This does not fail the gate; the gate checks internal consistency (JSON vs parquet cross-tab), which holds at 10.

all gates passed. 1300 rows.
wrote .../public/data/dtp-lists.json: 1300 rows, 295,756 bytes
wrote .../public/downloads/suffolk-dtp-lists.xlsx: 108,992 bytes
```

### The "16" in the design spec does not survive recomputation; the correct conflict count is 10

`docs/specs/2026-08-13-dtp-modal-v2-design.md` states, of the browse tab's
Conflicts filter chip, that it "shows the strings tagged YY whose review tier
is Rejected (**the 16**)." That figure conflates two different counts that
happen to share a source number:

- The review tab's `Proposed, disagreed` tier has **16** distinct strings
  after `current > agreed > disagreed` precedence (unconditional on class;
  already verified in the Task 6 section above).
- Of those 16, only **10** are *also* tagged class YY in the class tabs. The
  other 6 are NY (5 strings) or NS (1 string) in the class tabs. This makes
  sense once named: "disagreed" describes a reviewer's response to a
  *proposal to change* a charge's class, most often a proposal to move an
  NY- or NS-classified charge onto the decline list. A description already
  sitting on the YY tab and *also* carrying a disagreed review response is
  the exception (10 of 16), not the rule.

Both counts were independently confirmed against `public/data/hayden.parquet`
directly, not just against the workbook:

```sql
-- distinct charge_description strings, YY class AND disagreed review, filed 2022-2025
SELECT count(*) FROM (
  SELECT DISTINCT charge_description FROM read_parquet('public/data/hayden.parquet')
  WHERE filed_in_window AND dtp_class LIKE 'YY%' AND dtp_review = 'Proposed, disagreed'
);
-- 10

-- charge-level count, same filter
SELECT count(*) FROM read_parquet('public/data/hayden.parquet')
WHERE filed_in_window AND dtp_class LIKE 'YY%' AND dtp_review = 'Proposed, disagreed';
-- 2393 (matches the figure already on record from Task 6/7 above)
```

The charge-level figure (2,393) is unaffected; it was always a charge count,
not a string count, and it holds under both readings. Only the *string*
count changes: **10, not 16.** Task 1's JSON emits 10 rows with
`"conflict": true`, and the XLSX About sheet states the count as generated
(10 distinct descriptions, 2,393 charges filed 2022-2025). The design spec's
"the 16" and the browse-tab Conflicts chip copy planned for Task 3/4 should
be corrected to 10 before they ship; this was out of scope for Task 1 to fix
in the spec itself, so it is flagged here for the task that touches that
copy.

### XLSX read-back assertions

Opened with openpyxl in the same scratch venv:

- `wb.sheetnames == ['About', 'All lists', 'Decline list (YY)', 'Presumption against (NY)', 'Case-by-case (NS)', 'Ordinarily prosecuted (NN)']` -- **PASS**
- Every data sheet's header row is exactly `['Description', 'Class', 'Review tier', 'Charges filed 2022-2025', 'Charges filed 2006-2021']`, bold, with `freeze_panes == 'A2'` -- **PASS** (all five data sheets)
- Row counts per data sheet match the per-tab string counts: All lists 1,300; Decline list (YY) 69; Presumption against (NY) 107; Case-by-case (NS) 627; Ordinarily prosecuted (NN) 497 -- **PASS**
- `public/data/dtp-lists.json`: `generated` and `source_note` present and match the brief's schema; rows sorted class order YY/NY/NS/NN then description A-Z within class -- **PASS** (verified over all 1,300 rows, not sampled)
- Spot-checked rows: a conflict row (`COCAINE, DISTRIBUTE c94C §32A(c)`, YY, `Proposed, disagreed`, `conflict: true`, 171 charges 2022-2025 / 539 2006-2021), a zero-count row (`SCHOOL, FAIL SEND CHILD TO c76 §2`, NY, 0 / 0), and the largest string per class (YY: `LICENSE SUSPENDED, OP MV WITH c90 §23`, 6,451 charges 2022-2025; NY: `UNLICENSED OPERATION OF MV c90 §10`, 7,353; NS: `A&B ON FAMILY/HOUSEHOLD MEMBER c265 §13M`, 7,393; NN: `A&B WITH DANGEROUS WEAPON c265 §15A(b)`, 4,951) -- **PASS**

## Task 3: tabs, card redesign, links, sidebar (v2)

`src/ui/DtpFilterModal.tsx` was rebuilt around a three-tab structure (Decline
list / Review status / Browse the lists), the card redesign (share bar, fact
chips, links row, collapsed detail), and the two links this spec calls for.
`src/ui/FilterPanel.tsx`'s `dtp-entry` row became the two-line sidebar entry.
`src/ui/dtpModel.ts` picked up the three ledger carry-items below plus
`MEMO_URL`.

### Memo URL verification (spec Step 3)

**Search.** `grep -in "rollins.*memo\|policy memo"` over the blog repo's
`notes.md` and `debate/03-research/evidence/*.md` located
`debate/03-research/evidence/office-continuity-and-published-data.md`, whose
"The Rollins Memo, March 25, 2019" section records two working URLs found
during that essay's fact-check:

- A Wayback Machine capture: `https://web.archive.org/web/20190326183822/http://www.suffolkdistrictattorney.com/wp-content/uploads/2019/03/The-Rachael-Rollins-Policy-Memo.pdf`, retrieved there as HTTP 200, 41,909,954 bytes.
- The live SCDAO server copy: `https://www.suffolkdistrictattorney.com/s/The-Rachael-Rollins-Policy-Memo.pdf`, HTTP 200 as of 2026-08-08.

That same document records that the live site's navigation entry and landing
page for the memo ("Rachael Rollins Policy Memo") return 404 today; only the
PDF asset and the original press release survive on the live server. Per the
spec's "external archival URL" preference (a Wayback snapshot or an
equivalently stable host, not a page that could be taken down by the current
office), the Wayback capture was chosen as the candidate.

**Verification.** Loaded in a real Playwright/Chromium browser on 2026-08-13:
navigated to the Wayback URL above and confirmed it renders (not a Wayback
"page not archived" placeholder). The page shows the Wayback toolbar over a
PDF.js viewer, page 1 of 66, with the thumbnail and rendered first page
reading "THE RACHAEL ROLLINS POLICY MEMO." Screenshot:
`.playwright-mcp/dtp-v2-shots/memo-wayback-check.png` (in the blog repo, not
this repo). Page count (66) is consistent with the fact-check note's "a 65-page
policy memo" (SCDAO's own press-release description; off-by-one is cover-page
counting, not a different document).

**Result.** `MEMO_URL` in `src/ui/dtpModel.ts` is set to the Wayback URL
above. Linked in the modal header on the phrase "published a list"
(`target="_blank" rel="noopener noreferrer"`, with an external-link glyph).
`dtpModel.test.ts`'s `MEMO_URL` test was updated from asserting `null` to
asserting a non-null `https://web.archive.org/...` string.

### Ledger carry-item A: conflict count is 10, not 16

No UI text introduced by Task 3 states a number for the conflicting rows.
`DTP_CAVEAT.conflictLinkLabel` is "See the conflicting rows" (no count). The
YY card's caveat paragraph (below) also carries no count. This matches the
Task 1 finding above ("The '16' in the design spec does not survive
recomputation; the correct conflict count is 10"): the correction was made by
omission, not by swapping 16 for 10 in visible copy, since no shipped
sentence needed a number here.

### Ledger carry-item B: YY card's third paragraph, citation tail replaced

The YY card's (`dtp_class`, "On the decline list") third detail paragraph
cited "the data README" and "a ruling is pending", both unreachable by a
deployed-site reader per the design spec's "Links" section. Changed in
`src/ui/dtpModel.ts`:

```diff
- 'Caveat: 2,393 charges filed 2022 to 2025 carry this tag on ' +
-   'descriptions the review tab lists as proposed-but-disagreed. The ' +
-   'worksheet itself contains that conflict; a ruling is pending.',
+ '2,393 charges filed 2022 to 2025 carry this tag on descriptions ' +
+   'the review tab rejected. That conflict is in the source ' +
+   'classification. The Browse tab flags the conflicting rows.',
```

The factual content is unchanged (still the 2,393-charge figure verified in
the Task 6/7 table above, row 20); only the citation tail changed, from a
document the reader cannot open to a pointer at UI the reader can reach once
Task 4 ships the Browse tab. This is a UI pointer, not a new factual claim,
so it required no new source verification.

### Ledger carry-item C: agreed card's plain sentence, digit duplication

The `dtp_review` "Proposed and agreed, never adopted" card's `plain` sentence
repeated the "76" figure that Task 2 had already moved into a fact chip
("Charges marked agreed" = 76). Changed in `src/ui/dtpModel.ts`:

```diff
- plain: 'A 2020 review inside the office marked 76 further charges agreed for declination. The worksheet records no adoption of the expansion.',
+ plain: 'A 2020 review inside the office marked further charges agreed for declination. The worksheet records no adoption of the expansion.',
```

`dtpModel.test.ts`'s digit-duplication test previously checked only
`detail.paragraphs` against `detail.facts`. Extended to also fold `card.plain`
into the prose-numbers set being compared against chip numbers, so a future
regression in either `plain` or a paragraph is caught. All nine known cards
(five `dtp_class`, four `dtp_review`) pass with the extended check; no other
card's `plain` field carries any digit.

**Verification.** `npm run test` (68/68; `dtpModel.test.ts` still at 23 tests,
two of them changed in place: the `MEMO_URL` test and the digit-duplication
test) and `npm run build` both pass. Browser pass (2026-08-13, dev server on
port 5211, Playwright): tab bar click and ArrowRight keyboard nav both move
focus and selection; staged-count badge ("Decline list · 2") appears live off
`staged`, before Apply; share bars render proportional widths for each card
against its section total; fact chips render (69/46 on the YY card, 76/107/32
on the agreed card) with no digit overlap against the reflowed prose; the
memo link opens the verified Wayback URL in a new tab; the caveat's "See the
conflicting rows" link switches to tab 3, the placeholder renders, and
`console.log` confirms `browseConflicts` is `true` on that transition and
resets to `false` on any subsequent tab change (verified by manually
re-entering tab 3 after leaving it); the sidebar's two-line entry was checked
active and inactive at 1440px and 1000px (drawer). Screenshots under
`.playwright-mcp/dtp-v2-shots/` in the blog repo.

One observation outside this task's scope: toggling dark theme and then
screenshotting an open native `<dialog>` (via Playwright) rendered the modal
body as light-colored in the PNG despite `getComputedStyle` on the `<dialog>`
element confirming the correct dark `--surface` background and white text
were applied. The same mismatch reproduces on the pre-existing, unmodified
"About" modal, so it is not a regression from this task's changes; it looks
like a headless-Chromium/native-`<dialog>`-top-layer screenshot compositing
quirk rather than a real CSS defect, but it was not investigated further
since `Modal.tsx` and the base `.modal` rule are outside this task's file
list.

## Fix wave: the v2 adversarial content pass

`.superpowers/sdd/2026-08-13-dtp-modal-v2/pass-content.md` re-derived every v2
number against the workbook, both parquets and the memo PDF, and disputed none
of them: "Only the labels are wrong (C1, I1, I2, I3, I4), not the arithmetic."
What it found is that shortening verified sentences into fact chips dropped the
nouns that scoped them, and that the XLSX, the copy that leaves the site,
carried none of the corrections the modal spent Task 7 adding. This fix wave
changes labels and prose. No value changed, and no claim was added that is not
already verified in the Task 6 or Task 7 tables above.

### Assets: `scripts/prepare_dtp_lists.py` and its two outputs

The script's `SOURCE_NOTE` and About-sheet text changed; both assets were
regenerated and committed. `public/data/dtp-lists.json`'s 1,300 rows compare
equal to the previous generation (`git show HEAD:public/data/dtp-lists.json`,
parsed and compared row by row); only `source_note` differs. The XLSX's five
data sheets are unchanged in headers, row counts and freeze panes; only the
About sheet's text differs. All 14 gates re-ran PASS on the committed state.

| Finding | Ruling | Change | Where the text comes from |
|---|---|---|---|
| C2 (attribution) | R2 | About sheet's title line and paragraph 1 stop calling the classification the office's instrument: "a decline-to-prosecute classification worksheet made inside the Suffolk County District Attorney's office", "the worksheet assigns to it" | Reflow of the header detail's already-verified "a worksheet created inside the District Attorney's office in 2020" (Task 7 row 1) |
| C2 (69 versus 46) | R2 | New bolded About section, "The decline list (YY) sheet is broader than the operative list": the YY tab holds 69 descriptions and the sheet carries all 69; the operative list is the narrower 46, the rows marked `Current list` in the Review tier column; the extras include drug distribution charges the worksheet's own annotations say were not in the memo; the worksheet records no adoption of the expansion | Reflow of the modal's YY card and `DTP_CAVEAT`. 69 = Task 7 row 3, 46 = Task 7 row 6, the annotation claim = Task 7 row 5, the no-adoption claim = Task 7 row 14. The two counts are interpolated from the gated values (`per_tab_added['YY']`, `review_tally['Current list']`), not typed as literals |
| I9 | R2 | The Conflicts paragraph names no "'Conflicts' rows" the workbook does not label. It gives the recipe instead: "take the rows where Class is 'YY (decline list)' and Review tier is 'Proposed, disagreed'", keeping the 10-descriptions / 2,393-charges statement | Recipe verified by running it against the shipped workbook: `All lists` rows matching both values number 10 and their `Charges filed 2022-2025` sum to 2,393, and the 10 descriptions are the same set the JSON marks `"conflict": true` |
| I8 (XLSX half) | R2 | New bolded About section, "Where the two count columns come from", naming the 2022-2025 file and the pre-2022 file behind the two columns and stating that each counts every charge filed in that window across the whole file, whatever the explorer is filtered to | The two files are the parquets the script reads (`public/data/hayden.parquet`, `public/data/history.parquet`, both `WHERE filed_in_window`); the reconciliation section above proves each column's per-class sums against those files |
| I7 | R2 | `source_note` becomes "The data behind this view is derived from a classification worksheet created inside the Suffolk County District Attorney's office in 2020, applied to charge records by charge description. The table and the downloadable spreadsheet are derived; the original worksheet is not distributed." | Same provenance facts as before (Task 7 row 1); the referents change from "this file" and "the XLSX beside it", which have no on-screen target, to the table and the download button the reader can see |
| M1 (About half) | R11 | One About line defines the Review tier column's three values and states that a blank means the review never covered that description | Reflow of the `Not reviewed` card ("Everything the review never looked at", "absence from review is not a statement about them") and of `load_review()`'s own three-section docstring |

### Gate output on the committed state, verbatim

```
[PASS] YY tab holds 69 strings -- got 69
[PASS] review tab: 46 current / 107 agreed / 16 disagreed-after-precedence -- got {'Current list': 46, 'Proposed, agreed (never adopted)': 107, 'Proposed, disagreed': 16}
[PASS] no 75-char-prefix collisions among workbook class-tab strings (first-wins would apply if any existed) -- collision count = 0
[PASS] hayden YY (decline list): sum of per-string n_2022_2025 == parquet class total -- sum=39,106 parquet=39,106
[PASS] hayden NY (presumption against): sum of per-string n_2022_2025 == parquet class total -- sum=30,563 parquet=30,563
[PASS] hayden NS (case-by-case): sum of per-string n_2022_2025 == parquet class total -- sum=45,088 parquet=45,088
[PASS] hayden NN (prosecute): sum of per-string n_2022_2025 == parquet class total -- sum=44,501 parquet=44,501
[PASS] history YY (decline list): sum of per-string n_2006_2021 == parquet class total -- sum=221,881 parquet=221,881
[PASS] history NY (presumption against): sum of per-string n_2006_2021 == parquet class total -- sum=139,974 parquet=139,974
[PASS] history NS (case-by-case): sum of per-string n_2006_2021 == parquet class total -- sum=301,878 parquet=301,878
[PASS] history NN (prosecute): sum of per-string n_2006_2021 == parquet class total -- sum=191,417 parquet=191,417
[PASS] JSON rows: review-tier tally matches the independent workbook count (every review-tab string found a home among the class-tab strings) -- got {'Current list': 46, 'Proposed, disagreed': 16, 'Proposed, agreed (never adopted)': 107}
[PASS] conflict rows: JSON string count == hayden cross-tab distinct-string count -- JSON=10 parquet cross-tab=10
[PASS] conflict rows: charge-level count == 2,393 on record -- got 2,393

all gates passed. 1300 rows.
wrote .../public/data/dtp-lists.json: 1300 rows, 295,789 bytes
wrote .../public/downloads/suffolk-dtp-lists.xlsx: 109,475 bytes
```

XLSX read-back after regeneration: sheet names, per-sheet headers, bold header
row, `freeze_panes == 'A2'` and row counts (All lists 1,300; Decline list (YY)
69; Presumption against (NY) 107; Case-by-case (NS) 627; Ordinarily prosecuted
(NN) 497) all match the assertions recorded in the Task 1 section above. Dash
sweep over the new About text and `source_note`: no em dash, en dash, figure
dash, horizontal bar, minus sign or non-breaking hyphen.

### Modal and Browse tab: `src/ui/dtpModel.ts`, `src/ui/DtpBrowseTab.tsx`

Every chip below keeps the value the Task 6 or Task 7 table verified. Only the
label changed, and each new label restores the noun that made the number true.
The relocation table above was updated in place so it names the shipped labels.

| Finding | Ruling | Claim | Label before | Label now |
|---|---|---|---|---|
| C1 | R1 | Not listed is about 1% of the 2022-2025 file (Task 7 row 12: 2,124/200,630 = 1.06%, all rows in that file) | Share of 2022-2025 charges | **Share of the 2022-2025 file** |
| C1 | R1 | Not listed is about 6% of the pre-2022 file (Task 7 row 12: 63,555/1,092,889 = 5.82%, all rows in that file) | Share of 2006-2021 charges | **Share of the pre-2022 file** |
| I1 | R3, then NB1 | 76, the `DTP PROPOSED NEW CHARGES AGREED (76 new)` header's own count (Task 7 row 14) | Charges marked agreed | **Descriptions marked agreed** (R3's "Charge types" did not survive the re-review; see NB1 below) |
| I2 | R4 | 69 description strings on the worksheet's YY tab (Task 7 row 3) | Charge descriptions | **Worksheet YY strings** |
| I3 | R5 | 46 operative-list strings, on both the YY card and the Current list card (Task 7 rows 4 and 6) | Operative list / Operative charge descriptions | **Operative list strings** (both cards) |
| I4 | R6, then NB2 | 17 rows in the disagreed section, 16 strings left after the current list takes precedence (Task 7 row 17) | Raw rows / Strings after precedence | **Review rows** / **Strings left after precedence** (R6's "Distinct strings" did not survive the re-review; see NB2 below) |

Why C1 needed the file scope back: `filed_in_window` in `history.parquet`
marks charges filed 2006-2021, and the "about 6%" figure is a share of every
row in that file, whose filing dates run 1999-01-01 to 2022-01-12. Read as a
2006-2021 share it is 18,957/874,107 = 2.17%, and the card printing the chip
shows 2.0% next to it under the history toggle. The verified claim was always
file-scoped (Task 7 row 12, "all rows in each file"); Task 2's relocation
turned the file into a date range without re-deriving. The label now says what
was measured.

Three further copy changes, no number touched:

- **I5 (R7).** `DTP_CAVEAT` renders on both tabs since Task 3 split the
  sections, so "the decline-list tags above" pointed at nothing on the Review
  status tab. "above" is gone; the sentence names both tabs' objects
  explicitly and reads whole on either: "The decline-list tags come from the
  classification's broader YY tab; the operative 46-string list is the
  narrower set under Review status."
- **M2.** The YY card's third paragraph said "descriptions the review tab
  rejected", true for 9 of the 10 conflict descriptions; the tenth is the row
  whose annotation reads "PWID in memo and agree, Distribution not in memo and
  would not add at this time" (Task 7 row 18). It now reads "descriptions the
  review tab put in its disagreed section", which is true of the section for
  all 17 rows.
- **M3.** "this project's tagging preserves it" became "the tagging here
  preserves it": the modal never names a project.

Browse tab:

- **I6 (R8).** The conflict flag's title and accessible name are now neutral,
  "On the YY tab and in the review's disagreed section", rather than asserting
  a rejection the worksheet does not record for every flagged row (three read
  `HTU needs to be consulted`, one partly agrees; Task 7 row 18). The
  `Rejected` review chip stays: tier membership is factual, and the tier's own
  card is named "Proposed, rejected".
- **I8 (R9).** The provenance line gains one sentence, "Counts cover each
  dataset's filed charges and ignore any active filters." The two count columns
  are computed once by `scripts/prepare_dtp_lists.py` over each parquet's
  `filed_in_window` rows and do not move with the lens, the date range or any
  filter, while every card on the other two tabs is counted against the current
  view. (The sentence first shipped as "Counts cover the full datasets", which
  overstated the scope: `filed_in_window` is narrower than either file. See
  NB4 below.)
- **M4.** The loading and error states showed a shorter provenance sentence
  that dropped the derived-and-not-distributed disclosure. Both states now
  render `PROVENANCE_FALLBACK`, which mirrors the JSON's `source_note`.

### Deferred, with reasons

- **M1, Browse half.** The finding asks for a clause in the provenance line
  defining a blank review. Ruling R9 fixes that line's addition at one
  sentence, so the clause was not added there. The About sheet half was
  applied (see the assets table above), which is where a reader of the
  downloaded file meets the blank column.
- **M5.** Rendering a line above the table explaining the flag when the
  Conflicts chip is active needs new markup and a new style rule, past the
  one-line scope this wave was given. The flag's meaning is carried by its
  title and accessible name (I6 above) and by the caveat sentence that
  deep-links to this view.

### Verification

`npm run test` 84/84 (3 files; no test needed changing, since every chip value
is unchanged and the digit-duplication test compares values, not labels).
`npm run build` clean. `scripts/prepare_dtp_lists.py` re-run on the committed
state: all 14 gates PASS. `dist/data/dtp-lists.json` and
`dist/downloads/suffolk-dtp-lists.xlsx` are byte-identical (md5) to their
`public/` sources, so the audited text is the shipped text. Dash sweep over
`src/ui/dtpModel.ts`, `src/ui/DtpBrowseTab.tsx`, `scripts/prepare_dtp_lists.py`
and `public/data/dtp-lists.json`: no em dash, en dash, figure dash, horizontal
bar, minus sign or non-breaking hyphen. `package-lock.json` is byte-identical
to `3727e67` again (same md5), closing the regression pass's one Minor
finding: `git diff 3727e67 -- package-lock.json` is empty.

### Re-review round: the relabels' own breakage

The content re-review confirmed both Criticals fixed from source and found that
four of the new labels or sentences broke on their own terms. All four values
are still unchanged; these are label and wording corrections, one commit.

| # | What was wrong | Now reads |
|---|---|---|
| NB1 (Important) | "Charge types marked agreed" = 76 does not survive derivation: the agreed section's 107 rows yield 105, 101 or 68 distinct charge types depending on how the type is cut, never 76. 76 is the count the worksheet's own header gives, and it tracks the rows carrying a reviewer response, not a count of charge types | Chip **"Descriptions marked agreed"** = 76 |
| NB2 (Important) | "Distinct strings" = 16 is false as written: all 17 raw rows in the disagreed section are distinct strings. 16 is what the section has left after `current > agreed > disagreed` precedence moves `METHAMPHETAMINE, POSSESS TO DISTRIB c94C §32A(c)` to the current list (Task 6 row 4) | Chip **"Strings left after precedence"** = 16, with "Review rows" = 17 unchanged |
| NB4 (Minor) | "Counts cover the full datasets" overstates: both count columns are computed over `filed_in_window` rows only, which is narrower than either file | **"Counts cover each dataset's filed charges and ignore any active filters."** |
| NB5 (Minor) | `DTP_CAVEAT` still said "descriptions the review tab rejected" after M2 changed the YY card to "disagreed section", so one screen carried two words for one thing | Caveat sentence 1: "some charges tagged as on the decline list carry descriptions the review tab **marked disagreed**" |

**NB3, deferred by ruling.** The conflict flag's tooltip uses the term "YY tab"
without defining it. The term is defined in `DTP_CAVEAT`, which is the deep-link
entry path to the flagged rows, so a reader arriving at the flag has met it.
Recorded, no change.

`npm run test` 84/84 and `npm run build` clean after the four edits. No chip
value changed, so the digit-duplication test needed no extension.
