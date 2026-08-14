# Adversarial review: numbers (DTP modal v2)

Repo: suffolk-explorer, branch `dtp-modal-v2`, HEAD `592ecec`
Reviewer: fresh session, independent code (no import of `prepare_dtp_lists.py`)

## Per-check results

1. **Fresh venv re-run of `scripts/prepare_dtp_lists.py`, gates, byte-identity** — PASS
   - `uv venv` + `uv pip install duckdb openpyxl` in scratch (duckdb 1.5.5, openpyxl 3.1.5).
   - Ran the script unmodified from a scratch copy (`suffolk-package` and `suffolk-explorer`
     rebuilt as siblings so its `../../suffolk-package/reference/...` path resolves).
   - All 15 in-script gates PASS, including the two derived-vs-parquet cross-checks
     (conflict rows = 10 strings / hayden cross-tab = 10; conflict charges = 2,393).
   - `public/data/dtp-lists.json`: byte-identical to committed (`diff` clean, matching
     sha256 `6b7c5459...8928a09e`).
   - `public/downloads/suffolk-dtp-lists.xlsx`: `diff -rq` on the unzipped contents is
     clean except `docProps/core.xml`, which differs only in the `dcterms:created` /
     `dcterms:modified` timestamps (rerun vs. committed generation time). No other file
     in the zip differs.

2. **Independent re-derivation (own workbook reader, own normalization, own duckdb queries — no import of the script)** — PASS
   - Per-class string counts: YY=69, NY=107, NS=627, NN=497 (sum 1,300). Matches.
   - Review tiers: Current=46, Agreed=107, Disagreed=16. Matches.
   - Conflict strings: 10 (YY class ∩ Rejected review tier). Conflict charges
     2022-2025 (queried directly off `hayden.parquet`, not via the JSON): 2,393. Matches.
   - Built all 1,300 rows independently (own whitespace normalizer, own first-wins
     tab-scan, own 75-char-prefix index, own duckdb `GROUP BY charge_description`
     attribution) and diffed field-by-field against the committed JSON: **0 mismatches
     across all 1,300 rows** (description, dtp_class, dtp_review, conflict, n_2022_2025,
     n_2006_2021 all identical), not just the 8 sampled strings below.
   - Per-class sums of per-string counts reconcile exactly against each parquet's own
     `dtp_class` GROUP BY totals, both files (8/8 OK).
   - 8 sampled strings, independently derived and checked against the committed JSON:
     - Largest by n_2022_2025 per class:
       - YY: "LICENSE SUSPENDED, OP MV WITH c90 §23" — 6,451 / 40,162, review=Current list
       - NY: "UNLICENSED OPERATION OF MV c90 §10" — 7,353 / 30,920, review=Agreed
       - NS: "A&B ON FAMILY/HOUSEHOLD MEMBER c265 §13M" — 7,393 / 13,518, no review
       - NN: "A&B WITH DANGEROUS WEAPON c265 §15A(b)" — 4,951 / 28,660, no review
     - Zero-count string: "COMMON CARRIER, LARCENY FROM c266 §30(1)" (YY, Current list) —
       n_2022_2025=0, n_2006_2021=4
     - Conflict string: "COCAINE, DISTRIBUTE c94C §32A(c)" (YY, Rejected) — 171 / 539
     - String >75 chars: 6 workbook strings exceed 75 chars (75-94, matching the
       script's own comment). Spot-checked "MASSACHUSETTS STATE COLLEGE BUILDING
       AUTHORITY, FINANCIAL INTEREST VIOLATION c. 73 App. s. 1-2" (94 chars, NS,
       n=0/1).
     - Prefix-collision case (the "C94C §32E(" case the script's comment calls out
       by name): the 77-char workbook string "HEROIN/MORPHINE/OPIUM, TRAFFICKING IN,
       36 GRAMS OR MORE LESS 100 C94c §32E(c)" (class NN) has one hayden row truncated
       at exactly its own 75-char prefix. Queried hayden directly: 119 exact-match rows
       + 1 truncated-string row = 120; history: 87 exact + 0 truncated = 87. Both sums
       match the JSON row's n_2022_2025=120, n_2006_2021=87 exactly, confirming the
       wider prefix-index behavior documented in the script actually fires on this row.
     - All 8/8 sampled strings' JSON values matched the independent derivation exactly.

3. **XLSX per-sheet reconciliation against JSON** — PASS
   - Sheet names: About, All lists, Decline list (YY), Presumption against (NY),
     Case-by-case (NS), Ordinarily prosecuted (NN).
   - Row counts and sums of both count columns per sheet, compared to the JSON filtered
     the same way:
     - All lists: 1,300 rows, sum n_2022_2025=159,258, sum n_2006_2021=855,150 — OK
     - Decline list (YY): 69 rows, 39,106 / 221,881 — OK
     - Presumption against (NY): 107 rows, 30,563 / 139,974 — OK
     - Case-by-case (NS): 627 rows, 45,088 / 301,878 — OK
     - Ordinarily prosecuted (NN): 497 rows, 44,501 / 191,417 — OK
   - About sheet's "Conflicts" paragraph reads "10 distinct descriptions, covering
     2,393 charges filed 2022 to 2025" — matches the independently-derived 10/2,393.

4. **In-browser (dev server on port 5241, Playwright)** — PASS
   - Confirmed `location.href` before every read throughout. The shared Playwright
     browser did show cross-session interference exactly as flagged in the task:
     stray tabs on a different port (5252) appeared mid-session, and the MCP server's
     single "current tab" pointer got hijacked between consecutive tool calls at least
     three times (reads landed on `5252` and were discarded; one stray "Custom
     categories" / "About this data" dialog turned up on a shared tab from what was
     evidently another concurrent review pass). Mitigated by opening a dedicated new
     tab pinned to port 5241, re-selecting it immediately before each action, and
     guarding every `evaluate` call with an `location.href.startsWith('http://localhost:5241')`
     check that no-ops on mismatch. All numbers reported below are from reads where the
     guard confirmed port 5241.
   - **Six chip counts** (Browse tab, filtered table row count per chip, unfiltered
     search box): All=1,300, On the decline list=69, Presumption against=107,
     Case-by-case=627, Ordinarily prosecuted=497, Conflicts=10. All six match the
     per-class/conflict string counts exactly. The 10 Conflicts rows' descriptions were
     read from the DOM and diffed against the JSON's conflict-tagged descriptions: exact
     match, same order.
   - **Three sampled table rows** (index 0, 650, 1299 of the "All" chip's 1,300 rows):
     all three (`B&E FOR MISDEMEANOR c. 266 s. 16A`; `REGISTER MV OPERATED +30 DAYS
     YEAR, FL * c90 §3`; `WITNESS/JUROR/POLICE/COURT OFF, INTIMIDATE c268 §13B`)
     matched the JSON row at the same index field-for-field (class label, review
     column, both counts).
   - **Search box**: typing "trespass" returned 8 rows in the DOM; independently
     computed `'trespass' in description.lower()` over the JSON also returns exactly
     those same 8 descriptions.
   - **Two card-section denominators** (tab 1 "Decline list" / tab 2 "Review status",
     unfiltered view): both read "of 161,134 charges in the current view". Tab 1 card
     counts (39,106 / 30,563 / 45,088 / 44,501 / 1,876) and tab 2 card counts
     (36,688 / 28,482 / 2,517 / 93,447) each sum to 161,134 and match `dtp_class` /
     `dtp_review` GROUP BY totals queried directly off `hayden.parquet` with
     `filed_in_window`.
   - **Tabs 1-2 unchanged from v1 (aggregate-driven), sampled under a filter**: applied
     a live `court = "Chelsea Court"` filter via the sidebar MultiSelect (URL hash
     decoded to `{"filters":{"court":["Chelsea Court"]}}`, confirming the filter really
     applied). Reopened the DTP modal; tab 1 read "of 24,769 charges in the current
     view" with cards 3,883 / 7,830 / 8,099 / 4,748 / 209. Independently queried
     `hayden.parquet WHERE filed_in_window AND court = 'Chelsea Court'`: total 24,769,
     `dtp_class` breakdown YY=3,883 NY=7,830 NS=8,099 NN=4,748 Not listed=209. Exact
     match, confirming the modal's class/review tabs still recompute live off the
     aggregate engine rather than off the static Browse-tab JSON.
   - Dev server killed after (port 5241 confirmed free).

5. **Unit tests** (bonus, not in the required method list): `npx vitest run
   src/ui/dtpBrowse.test.ts src/ui/dtpModel.test.ts` — 39/39 passed, including the
   suite's own independent checks against the committed JSON (review-tier tally,
   conflict iff, sort order, chip filtering on real data).

## Findings by severity

None. No mismatch found anywhere: not in the script's own gates, not in the
independent field-by-field rebuild of all 1,300 rows, not in the XLSX sheets, not in
any in-browser read (chip counts, sampled rows, search, denominators, or the
filtered-view cross-check against duckdb).

One non-finding worth recording since it cost real time: the shared Playwright browser
had at least one other concurrent session's tab/state bleeding into this session's
reads (a different port, and at least one stray dialog from what looks like the
content or regression pass). Every number in this report came from a read where
`location.href` was verified to be `http://localhost:5241` at read time; several
initial reads were discarded because the guard caught a `5252` href or a stale DOM
snapshot mid-transition. This is a process note about the review environment, not a
defect in the DTP modal v2 code.

## Bottom line

Every number-bearing surface in DTP modal v2 (the prep script's gates, the committed
JSON, the committed XLSX, and the live Browse/Decline-list/Review-status tabs)
reconciles exactly against an independent re-derivation from the source workbook and
the two parquets. No lying number found.
