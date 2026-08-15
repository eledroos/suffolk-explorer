# Round-2 adversarial numbers spot-check

suffolk-explorer, branch `severity-chapter-filters`, HEAD `7ceda50`.
Dev server http://localhost:5173. Playwright MCP, `location.href` confirmed
before each read. Ground truth: duckdb 1.5.5 (python module, via
`.venv/bin/activate` in the suffolk-explorer repo root) over
`data/assembled/hayden-era-charges-2022-2025.csv` (161,134 filings /
153,920 dispositions / 200,630 total rows) and `pre-2022-composite.csv`
(1,092,889 rows, no severity_class/statute_chapter columns of its own).

Chapter rule replicated verbatim from `scripts/prepare_data.py` /
`prepare_history.py`:
`regexp_extract(trim(charge_code), '^([0-9]+[A-Z]?)[/.]', 1)` -> token;
`'c. '||token` if non-empty else `'No statute code'`. Confirmed duckdb's
`regexp_extract` returns `''` (not NULL) on no match, so the "No statute
code" predicate is `... = ''`.

Read paths: (a) opening the Severity/Chapter filter modals and reading
`.dtp-card`/`.chapter-row` counts directly from the live DOM, (b)
navigating to hand-built `ViewState` hashes (verified against
`src/engine/view.ts`'s `encodeView`/`decodeView`, itself unmodified code)
so the app's own decode -> aggregate -> render pipeline produces the
number, then reading the status badge or the Table chart's footer /
Share column. Every hash used only fields the app itself would emit; this
is not bypassing the UI, it's the same code path `Copy link` drives.

All ten independently derived. No prior results file consulted.

---

## 1. Severity modal, Felony card, default view (filings lens)

SQL:
```sql
SELECT COUNT(*) FROM hayden WHERE filed_in_window AND severity_class='Felony';
```
SQL: **46,568**
DOM (Severity modal, Felony card count): **46,568**
MATCH

## 2. Severity modal, Civil infraction card, Dispositions lens

SQL:
```sql
SELECT COUNT(*) FROM hayden WHERE disposed_in_window AND severity_class='Civil infraction';
```
SQL: **16,770**
DOM (lens=Dispositions, Severity modal, Civil infraction card): **16,770**
MATCH

## 3. Chapter modal, c. 94C row, default view (filings lens)

SQL:
```sql
SELECT COUNT(*) FROM hayden
WHERE filed_in_window AND regexp_extract(trim(charge_code), '^([0-9]+[A-Z]?)[/.]', 1) = '94C';
```
SQL: **15,715**
DOM (Chapter modal, "c. 94C" row): **15,715**
MATCH

## 4. Chapter modal, "No statute code" row, default view (filings lens)

SQL:
```sql
SELECT COUNT(*) FROM hayden
WHERE filed_in_window AND regexp_extract(trim(charge_code), '^([0-9]+[A-Z]?)[/.]', 1) = '';
```
SQL: **2,203**
DOM (Chapter modal, "No statute code" row): **2,203**
MATCH

## 5. Chapter modal, c. 269 row, with severity_class=Felony applied (filings lens)

SQL:
```sql
SELECT COUNT(*) FROM hayden
WHERE filed_in_window AND severity_class='Felony'
  AND regexp_extract(trim(charge_code), '^([0-9]+[A-Z]?)[/.]', 1) = '269';
```
SQL: **5,588**
DOM (Severity=Felony applied via modal -> status badge read 46,568 of 200,630,
confirming the filter took -> Chapter modal, "c. 269" row): **5,588**
MATCH

## 6. Severity modal, Misdemeanor card, with court=Dorchester Court applied (filings lens)

SQL:
```sql
SELECT COUNT(*) FROM hayden
WHERE filed_in_window AND court='Dorchester Court' AND severity_class='Misdemeanor';
```
SQL: **17,491**
DOM (Court=Dorchester Court applied via the Court multi-select -> Severity modal,
Misdemeanor card): **17,491**
MATCH

## 7. statute_chapter=c. 266 applied, chart=Table, x=Filed under (DA): table total (filings lens)

SQL:
```sql
SELECT COUNT(*) FROM hayden
WHERE filed_in_window AND regexp_extract(trim(charge_code), '^([0-9]+[A-Z]?)[/.]', 1) = '266';
```
SQL: **23,670**
DOM (view hash `chart=table, x=filed_under, filters.statute_chapter=['c. 266']`;
Table footer "Sum of rows"; status badge agreed at 23,670 of 200,630): **23,670**
MATCH

## 8. History on, Both lens: "Not graded (pre-2022)" card count

Both lens applies no window flag and no default date filter, and every row of
the pre-2022 composite gets the constant `severity_class = 'Not graded
(pre-2022)'` at parquet build (`prepare_history.py`), so this reduces to the
composite's raw row count.

SQL:
```sql
SELECT COUNT(*) FROM pre2022_composite;  -- no severity_class column in the raw CSV
```
SQL: **1,092,889**
DOM (history checkbox on, lens=Both via hash `lens=all, history=true`; total
badge read 1,293,519 = 200,630 + 1,092,889, confirming the merge; Severity
modal "Not graded (pre-2022)" card): **1,092,889**
MATCH
(Bonus: the modal's other four cards read 61,117 / 116,607 / 20,101 / 2,805
Felony/Misdemeanor/Civil infraction/Unclassified, exactly the unfiltered
hayden-file severity_class distribution independently queried.)

## 9. Invented cross-check: filings lens, court=Chelsea Court + statute_chapter=c. 90 + severity_class=Misdemeanor

Three filters stacked (court, chapter, severity), no modal involved for the
read: the header status badge.

SQL:
```sql
SELECT COUNT(*) FROM hayden
WHERE filed_in_window AND court='Chelsea Court'
  AND regexp_extract(trim(charge_code), '^([0-9]+[A-Z]?)[/.]', 1) = '90'
  AND severity_class='Misdemeanor';
```
SQL: **8,200**
DOM (status badge, view hash with all three filters applied): **8,200 of 200,630**
MATCH

## 10. Percentage check: series=Severity, Table chart, Share column, year=2023, Felony row (filings lens, default granularity overridden to Year)

Table's Share column with a series present divides each cell by the sum of
all series values for that x (all severity classes filed that year), which
is "% within view" (`pctDenom='view'`) semantics per `src/ui/AggTable.tsx`.

SQL:
```sql
SELECT
  (SELECT COUNT(*) FROM hayden WHERE filed_in_window AND EXTRACT(year FROM filing_date)=2023 AND severity_class='Felony') AS num,
  (SELECT COUNT(*) FROM hayden WHERE filed_in_window AND EXTRACT(year FROM filing_date)=2023) AS denom;
```
SQL: num **11,374**, denom **39,260** -> 11374/39260*100 = 28.970962...% -> rounds
(`fmtPct`, `toFixed(1)`) to **29.0%**
DOM (Table row "2023 / Felony"): value **11,374**, share **29.0%**
MATCH
(Bonus: the four 2023 series rows summed to 39,260 in the DOM, matching the
denominator exactly: Misdemeanor 22,563 (57.5%) + Felony 11,374 (29.0%) +
Civil infraction 4,805 (12.2%) + Unclassified 518 (1.3%) = 39,260.)

---

## Summary

- Comparisons: 10
- Matched: 10
- Mismatched: 0

No discrepancies found. Every value read from the live DOM (filter-modal
cards/rows, status badge, or Table chart footer/Share column) reproduced
exactly from independently written SQL against the two source CSVs, using
the chapter-parsing regex and severity/lens semantics read cold from
`src/ui/severityModel.ts`, `src/ui/chapterModel.ts`, `src/contract.ts`,
`src/engine/aggregate.ts`, `src/ui/modalCounts.ts`, and
`scripts/prepare_data.py` / `prepare_history.py` (not from any prior
review's notes).
