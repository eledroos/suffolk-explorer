# Suffolk Explorer — design spec

A Tableau-style, client-only explorer for `public/data/hayden.parquet`
(200,630 charge rows, Suffolk DA 2022-2025, adult courts). React + Vite + TS.
Deploys to Cloudflare Pages; data optionally served from R2 via `VITE_DATA_URL`.

`src/contract.ts` is FROZEN. Engine and UI are built against it in parallel.

## Module ownership (hard boundary; do not edit the other side's files)

- **Engine agent**: `src/engine/**`, `src/engine.test.ts`. Pure TS, no React.
- **UI agent**: `src/ui/**`, `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `index.html`.
- Neither edits: `src/contract.ts`, `package.json`, `vite.config.ts`, `tsconfig*.json`, `scripts/`, `public/`.

## Features (v1, all required)

1. **Lens toggle** (Filings / Dispositions / All): picks the date field and
   window flag per `LENS_INFO`. Changing lens swaps the x date column and
   re-filters. The blurb renders under the toggle.
2. **Chart types**: line, bar (grouped), stackedBar, pctBar (100%), area
   (stacked), heatmap (x dim × series dim, sequential ramp), pivot (rows =
   series dim, cols = x dim, measure cells + row/col totals), table
   (aggregated, sortable by clicking headers). CSV download of the current
   aggregation. Time x uses granularity month/quarter/year.
3. **Encodings**: X = lens date field (time mode) or any groupable dim;
   Series/color = any groupable dim or custom grouping or none. Measure =
   charges / distinct cases / distinct people; % of total toggle (within x,
   i.e., share across series per x when series present, else share of total).
4. **Filters**: multi-select checklists for every `filterable` cat column
   (searchable list, select-all/none), date range (from/to) on the lens date
   field. Active filters shown as removable chips.
5. **Custom category builder**: create/edit/delete groupings per
   `Grouping`; base = any groupable cat column; assign values to named
   buckets via click-to-move lists; unassigned bucket label editable;
   persists to localStorage; export/import JSON; ships with
   `PRESET_GROUPINGS` (one example over disposition_description named
   "Disposition family (example)" grouping obvious variants: Dismissed-type
   [Dismissed, Nole Prosequi, No True Bill], Plea, Trial verdicts [Verdict -
   Jury Trial, Verdict - Bench Trial], Diversion-type [Diversion, Pre Trial
   Probation, Continued w/o Finding], everything else -> Other. Mark it
   "(example — edit me)"). Groupings usable anywhere a Dim is accepted and in
   filters (filtering on bucket names).
6. **Data-quality notices** (`noticesFor`): 
   - lens=dispositions AND (no court filter or Suffolk Superior selected) AND
     date range touches Oct 2024 - Dec 2025 (capped at the dataset's disposition end; pinned by test) → warn: "Suffolk Superior dispositions are
     missing from Oct 2024 through Dec 2025 (~2,000 charges; records request
     pending). Totals for that period undercount the felony docket."
   - lens=filings AND range touches 2025 → info: "2025 filings run ~2-3% low:
     sealed cases were removed before the Mar 2026 extract."
   - lens=filings AND series/measure involves disposition fields → warn:
     "Outcome shares for 2024-2025 filing cohorts are right-censored: 46,575
     charges were still open at extraction."
   - lens=dispositions AND range touches 2022-01 → info: "Window opens
     Jan 3, 2022; Jan 1-2 had no filings (weekend)."
   Notices render as dismissable banners above the chart.
7. **Shareable URL**: full ViewState in location.hash via encodeView/decodeView;
   restored on load; "Copy link" button. (Groupings live in localStorage, not
   the URL; a view referencing a missing grouping falls back gracefully.)
8. **About panel** (modal): dataset provenance in brief — sources per segment,
   the seven limitations from `data/assembled/README.md`, row counts.
9. **Theme**: light/dark from `prefers-color-scheme` + manual toggle;
   palette strictly from `PALETTE`. >8 series folds into "Other" (MAX_SERIES).
10. **Perf**: single parquet fetch + decode (hyparquet), typed-array columns,
    aggregation < 100ms; show a loading state with row count when ready.
11. **DTP filter modal (v2)**: the Case group's `dtp_class`/`dtp_review`
    MultiSelects are replaced by one "Decline-to-prosecute" entry opening a
    three-tab modal (`src/ui/DtpFilterModal.tsx`, logic in `src/ui/dtpModel.ts`).
    Tab 1: Decline list (dtp_class categories with fact chips, share bars, live
    counts via `aggregate()` minus DTP filters). Tab 2: Review status (dtp_review
    categories with the same layout). Tab 3: Browse the lists (searchable table
    sourced from `public/data/dtp-lists.json` with drill-down filters; XLSX
    download via `public/downloads/suffolk-dtp-lists.xlsx`). Staged
    Apply/Cancel, MultiSelect-identical normalization, two-line sidebar entry.
    Specs: `docs/specs/2026-08-12-dtp-filter-modal-design.md` (v1) and
    `docs/specs/2026-08-13-dtp-modal-v2-design.md` (v2).
12. **Severity and statute-chapter filters:** two more charge-level columns,
    `severity_class` (Felony / Misdemeanor / Civil infraction / Unclassified,
    graded from the Feb 2026 Sentencing Commission Master Crime List, plus the
    constant `"Not graded (pre-2022)"` on every history row rather than a
    null, so the 2006-2021 dataset stays visible instead of silently
    vanishing from a severity chart or filter) and `statute_chapter` (the MGL
    chapter parsed from `charge_code`, "c. 265" style, or `"No statute code"`
    for catch-all and legacy codes). Each gets its own Case-group entry in
    `FilterPanel.tsx`, reusing the Decline-to-prosecute entry's exact
    dtp-entry markup and staged Apply/Cancel modal pattern rather than a new
    one: `SeverityFilterModal.tsx` (card list, `severityModel.ts`) and
    `ChapterFilterModal.tsx` (searchable, sorted-by-count list with
    malegislature.gov links, `chapterModel.ts`). Both columns are also
    excluded from the generic MultiSelect list the same way `dtp_class`/
    `dtp_review` already were (`filterEntries.ts`'s `isDedicatedModalCol`).
    Because the pre-2022 dataset carries no real severity grading, `noticesFor`
    (`src/engine/notices.ts`) emits an info notice, "Severity filter excludes
    2006-2021," whenever a severity filter is active with history on and the
    selection omits `"Not graded (pre-2022)"`; unlike the rest of this
    section's notices this one is not a `CoverageEntry` in `coverage.ts`,
    since it describes a filter/toggle interaction rather than a known
    limitation of a source delivery.
    Spec: `docs/specs/2026-08-15-severity-chapter-filters-design.md`.
    Ground truth: `docs/specs/severity-chapter-ground-truth.py` and its
    results file, run against the assembled CSVs independently of the
    parquet build.

## Data and tooling

**DTP lists preparation:** `scripts/prepare_dtp_lists.py` generates
`public/data/dtp-lists.json` (1,300 classification rows) and
`public/downloads/suffolk-dtp-lists.xlsx` (workbook with About sheet and
per-class data tabs). Both are sourced from `public/data/hayden.parquet` and
`public/data/history.parquet` plus the classification workbook. Reconciliation
gates verify class-tab string counts against parquet totals and fail loudly if
mismatches occur. Regenerate both assets after any parquet rebuild or workbook
modification. See `docs/specs/dtp-ground-truth-results.md` for the reconciliation
logic and per-file counts.

## Acceptance checks (the checker agent runs these)

- `npm run typecheck`, `npm run test`, `npm run build` all pass.
- Engine tests assert against verified ground truth:
  filings lens, no filters: 2022=37,399 · 2023=39,260 · 2024=43,880 · 2025=40,595 charges;
  dispositions lens: 2022=37,091 · 2023=38,536 · 2024=41,146 · 2025=37,147;
  filed_under Hayden=160,036 / Rollins=36,045 / Conley=4,549;
  total rows 200,630.
- App boots, renders default view (monthly filings line), lens switch works,
  a stacked bar by court renders, a custom grouping can be created and used
  as series, CSV export downloads, URL round-trips a view.
