# Severity + statute-chapter filters — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Two modal-backed filters (Severity; Statute chapter) per
`docs/specs/2026-08-15-severity-chapter-filters-design.md`. The data layer
and contract change are already merged on this branch (commit fa58746);
these tasks are UI-only.

**Architecture:** Two small model modules (verified copy + staging/count
helpers) consumed by two modal components, integrated into FilterPanel via
the existing dtp-entry pattern. A shared `modalCounts.ts` carries the
count-view helpers so the reviewed DTP modules stay untouched.

**Tech stack:** React 18 + TypeScript + Vite; vitest; native `<dialog>` via
`src/ui/Modal.tsx`; CSS in `src/styles.css` following the dtp-* class
conventions.

## Global constraints

- `src/contract.ts` is frozen except as already amended on this branch; do
  not edit it.
- Do NOT edit `src/ui/dtpModel.ts`, `DtpFilterModal.tsx`, `DtpBrowseTab.tsx`,
  or `dtpBrowse.ts` — they passed adversarial review; mirror, never modify.
- Severity parquet values, verbatim: `Felony`, `Misdemeanor`,
  `Civil infraction`, `Unclassified`, `Not graded (pre-2022)` (last one
  exists only in history rows).
- Chapter parquet values: `c. <token>` (e.g. `c. 265`, `c. 94C`) and
  `No statute code`.
- Chapter link pattern, verified working 2026-08-15:
  `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=<token>`
  (e.g. `...GoTo?ChapterGoTo=94C`); external links get
  `target="_blank" rel="noopener noreferrer"`.
- Copy below ships VERBATIM; the content review pass owns correcting it
  against sources. Do not paraphrase, "improve", or add sentences.
- No AI attribution of any kind in commit messages.
- Run `npx vitest run` (all suites) before every commit.

---

### Task 1: models + shared count helpers + tests

**Files:**
- Create: `src/ui/modalCounts.ts`
- Create: `src/ui/severityModel.ts`
- Create: `src/ui/chapterModel.ts`
- Create: `src/ui/severityModel.test.ts`
- Create: `src/ui/chapterModel.test.ts`

**Read first:** `src/ui/dtpModel.ts` (the pattern being mirrored),
`src/contract.ts`, `src/ui/MultiSelect.tsx` (selection semantics).

**modalCounts.ts** — generalized versions of the two helpers the DTP model
carries privately (mirror its logic; do not import from dtpModel):

```ts
import type { Grouping, ViewState } from '../contract';

/** The view used for a filter modal's live counts: the current view with
 *  the modal's own columns stripped from filters and measure forced to
 *  charges (counts are charge rows, whatever the chart measures). */
export function buildCountViewFor(cols: string[], view: ViewState): ViewState;

/** Cache signature: counts recompute only when anything OTHER than the
 *  modal's own staged columns changes. */
export function countSignatureFor(cols: string[], view: ViewState, groupings: Grouping[]): string;
```

**severityModel.ts** exports:

```ts
export const SEVERITY_COL = 'severity_class';
export const SEVERITY_VALUES = ['Felony', 'Misdemeanor', 'Civil infraction', 'Unclassified'] as const;
export const SEVERITY_HISTORY_VALUE = 'Not graded (pre-2022)';
export interface SeverityCard {
  value: string;
  blurb: string;                       // the one-liner under the name
  detail: { paragraphs: string[]; links?: { label: string; href: string; external: boolean }[] };
}
export const SEVERITY_CARDS: SeverityCard[];          // 5 entries, order above + history value last
export const SEVERITY_HEADER: { paragraphs: string[]; links: {...}[] };
export const SEVERITY_FOOTNOTE_NO_HISTORY: string;    // shown when view.history is false
export function severitySummary(selected: string[]): string;  // 'Felony' | 'Felony + 2 more'
export function normalizeSeverity(selected: string[], available: string[]): string[]; // full selection -> []
```

Copy, verbatim (content review corrects against sources; you transcribe):

- HEADER paragraphs:
  1. `Severity is graded from the Massachusetts Sentencing Commission's Felony and Misdemeanor Master Crime List (February 2026 edition), applied to each charge's statute code and charge text.`
  2. `The dividing line is where the sentence can be served: a crime punishable by imprisonment in state prison is a felony (G.L. c. 274 § 1); every other crime is a misdemeanor.`
  - links: `The Master Crime List (mass.gov)` -> `https://www.mass.gov/lists/sentencing-commission-master-crime-list` (external); `G.L. c. 274 § 1` -> `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=274` (external).
- Felony blurb: `Crimes punishable by imprisonment in state prison.`
  detail paragraph: `A charge that pleads no repeat-offense enhancement is graded as the base offense; repeat-offense charges (2nd, 3rd, subsequent) are graded at their pleaded tier.`
- Misdemeanor blurb: `Every other crime; the maximum sentence runs in a house of correction.`
  detail paragraph: `Fine-only crimes are misdemeanors too. Unlicensed operation of a motor vehicle stays here rather than with the civil infractions because chapter 90C expressly keeps it a crime.`
- Civil infraction blurb: `Not crimes: civil motor vehicle infractions charged alongside criminal cases.`
  detail paragraph: `Speeding, marked-lanes and similar violations are civil under G.L. c. 90C. They appear in this dataset because they were filed in criminal court, usually next to criminal charges. Nearly all carry SCDAO's own civil-infraction marker in the charge text; the rest were graded civil by statute.`
- Unclassified blurb: `Charges the grading declined to guess.`
  detail paragraph: `Three families: offenses graded by an underlying crime the charge does not name (attempts, conspiracies, fugitive-from-justice holds, failures to appear); pre-2018 charge language whose dollar amount straddles today's felony line; and catch-all codes with no identifiable statute.`
- Not graded (pre-2022) blurb: `The 2006-2021 dataset is not graded.`
  detail paragraph: `The crime list states current law, and the law moved: larceny's felony line rose from $250 to $1,200 in 2018, and offenses have been created since. Grading 2006-2021 charges needs the law as it stood at charging, which this project has not done. Rather than guess, these rows are labeled Not graded.`
- SEVERITY_FOOTNOTE_NO_HISTORY: `The 2006-2021 dataset is not graded for severity; turn on "Include 2006-2021" to see it listed here.`

**chapterModel.ts** exports:

```ts
export const CHAPTER_COL = 'statute_chapter';
export const NO_CODE_VALUE = 'No statute code';
export const CHAPTER_TITLES: Record<string, string>;  // token -> official title; ABSENT token = number-only
export function chapterTitle(value: string): string | null;   // 'c. 265' -> title or null
export function chapterHref(value: string): string | null;    // null for NO_CODE_VALUE
export function chapterSummary(selected: string[]): string;   // 'c. 265' | 'c. 265 + 2 more'
export function filterChapters(rows: {value: string; count: number}[], query: string): typeof rows; // pure
export const CHAPTER_PROVENANCE: string;
```

- CHAPTER_PROVENANCE: `Chapter parsed from each charge's statute code. Charges whose code carries no chapter (catch-all and legacy codes) are grouped under "No statute code".`
- `filterChapters`: case-insensitive substring on the value ('265', 'c. 265')
  and on the title; empty query returns rows unchanged.
- CHAPTER_TITLES initial map (token -> title). Every entry is subject to the
  content-verification pass; entries it cannot verify get REMOVED there, and
  `c. 258` and `c. 279C` are deliberately absent (SCDAO truncates 258E to
  258 and miscodes 279 as 279C; a real chapter title would mislead):

```ts
'90': 'Motor Vehicles and Aircraft',
'265': 'Crimes Against the Person',
'266': 'Crimes Against Property',
'94C': 'Controlled Substances Act',
'269': 'Crimes Against Public Peace',
'272': 'Crimes Against Chastity, Morality, Decency and Good Order',
'268': 'Crimes Against Public Justice',
'275': 'Proceedings to Prevent Crimes',
'89': 'Law of the Road',
'209A': 'Abuse Prevention',
'267': 'Forgery and Crimes Against the Currency',
'274': 'Felonies, Accessories and Attempts to Commit Crimes',
'234A': 'Office of Jury Commissioner for the Commonwealth',
'138': 'Alcoholic Liquors',
'276': 'Search Warrants, Rewards, Fugitives From Justice, Arrest, Examination, Commitment and Bail. Probation Officers and Board of Probation',
'140': 'Licenses',
'159A': 'Common Carriers of Passengers by Motor Vehicle',
'40': 'Powers and Duties of Cities and Towns',
'151A': 'Unemployment Insurance',
'90B': 'Motorboats, Other Vessels and Recreational Vehicles',
'22E': 'State DNA Database',
'270': 'Crimes Against Public Health',
'85': 'Regulations and By-Laws Relative to Ways and Bridges',
'127': 'Officers and Inmates of Correctional Institutions. Paroles and Pardons',
'271': 'Crimes Against Public Policy',
'159': 'Common Carriers',
'101': 'Transient Vendors, Hawkers and Pedlers',
'148': 'Fire Prevention',
'112': 'Registration of Certain Professions and Occupations',
'267A': 'Money Laundering',
'131': 'Inland Fisheries and Game and Other Natural Resources',
'64C': 'Cigarette Excise',
'160': 'Railroads',
'119': 'Protection and Care of Children, and Proceedings Against Them',
'62C': 'Administration of Taxes',
'140D': 'Consumer Credit Cost Disclosure',
'130': 'Marine Fish and Fisheries',
'268A': 'Conduct of Public Officials and Employees',
'161A': 'Massachusetts Bay Transportation Authority',
'149': 'Labor and Industries',
'118E': 'Division of Medical Assistance',
'161': 'Street Railways',
'90D': 'Motor Vehicle Certificates of Title',
'234': 'Juries',
'94G': 'Regulation of the Use and Distribution of Marijuana Not Medically Prescribed',
'90C': 'Procedure for Motor Vehicle Offenses',
```

**Tests** (write before implementations where practical; each asserts real
behavior, no vacuous asserts):

- modalCounts: strips exactly its own columns from filters, keeps others;
  forces measure 'charges'; signature changes when an unrelated filter
  changes and does NOT change when only the own-column staging changes.
- severityModel: card values are exactly the five allowed strings in order;
  every blurb and paragraph non-empty; header has 2 links with external
  true; summary label for 0 (=> 'any'), 1, and 3 selections; normalize
  returns [] when every available value is selected.
- chapterModel: href null for NO_CODE_VALUE and correct URL for 'c. 94C';
  title null for 'c. 258' and 'c. 279C' and present for 'c. 265';
  filterChapters matches '94c' (case-insensitive), matches by title word
  ('Currency' finds c. 267), empty query is identity; no CHAPTER_TITLES
  value is empty; summary labels as severity.

**Steps:** write tests -> run (fail) -> implement -> run (pass) ->
`npx vitest run` -> commit `Severity and chapter filter models`.

---

### Task 2: the two modals + styles

**Files:**
- Create: `src/ui/SeverityFilterModal.tsx`
- Create: `src/ui/ChapterFilterModal.tsx`
- Modify: `src/styles.css` (new classes only; reuse dtp-* styles by
  composition where the DTP modal's classes are generic — inspect first)

**Read first:** `src/ui/DtpFilterModal.tsx` end to end (card markup, share
bars with aria-hidden, staged footer, dialog focus handling),
`src/ui/Modal.tsx`, `src/ui/DtpBrowseTab.tsx` (search + row list pattern),
Task 1's modules.

**Interfaces:** both components take
`{ ds, view, groupings, onSetFilter, onClose }` exactly like
DtpFilterModal (see FilterPanel.tsx integration in Task 3).

**SeverityFilterModal:**
- Header block: SEVERITY_HEADER paragraphs + links row.
- Cards from SEVERITY_CARDS; the history card renders ONLY when
  `view.history` is true; when false, render SEVERITY_FOOTNOTE_NO_HISTORY
  as a muted line under the cards.
- Each card: checkbox + name + live count (right-aligned, tabular) + share
  bar (aria-hidden, width = count / stripped-view total) + blurb; a "More"
  disclosure reveals detail paragraphs + links (match the DTP card
  disclosure markup).
- Counts: `aggregate(ds, buildCountViewFor([SEVERITY_COL], view), groupings)`
  grouped by severity_class — follow how DtpFilterModal derives its counts,
  memoized on `countSignatureFor`.
- Staged selection: initialized from `view.filters.severity_class ?? []`;
  Apply calls `onSetFilter(SEVERITY_COL, normalizeSeverity(staged, available))`;
  Cancel discards; Clear empties staged (does not auto-apply). Footer
  markup identical to the DTP modal's.
- Dialog title: `Severity`. aria: role/labelledby per Modal.tsx contract.

**ChapterFilterModal:**
- Provenance line (CHAPTER_PROVENANCE) with the live No-statute-code count
  interpolated separately AFTER the sentence, not inside it:
  `<sentence> Currently [n] charges.` is WRONG — instead render the count
  on the No statute code row only.
- Search input (labelled, autofocus) filtering via `filterChapters`.
- Rows: all chapter values present in the dataset (from
  `distinctValues(ds, CHAPTER_COL)`), ordered by live count descending,
  `No statute code` pinned last when query is empty. Each row: checkbox ·
  value (`c. 265`) · title (muted; absent for unmapped tokens) · count ·
  share bar · external-link icon-button (chapterHref; none for No statute
  code). Long titles wrap under the value without breaking column
  alignment (grid).
- Zero-result query: an empty-state line `No chapter matches "<query>".`
- Staged Apply/Cancel/Clear identical to Severity.
- Dialog title: `Statute chapter`.

**Styles:** follow the DTP modal's spacing/typography tokens; per-modal
width: Severity like the DTP list tabs (~654px), Chapter wider (~760px)
with a scrollable row region; dark mode via existing tokens; visible focus
styles on rows and links.

**Steps:** implement Severity -> `npx vitest run` + `npm run build` ->
implement Chapter -> run again -> commit
`Severity and statute-chapter filter modals`.

---

### Task 3: FilterPanel integration + notice + docs

**Files:**
- Modify: `src/ui/FilterPanel.tsx`
- Modify: `src/engine/notices.ts`
- Create: `src/ui/filterEntries.test.ts` (or extend an existing UI test
  file if one covers FilterPanel)
- Modify: `docs/DESIGN.md` (new feature entry)
- Create: `docs/specs/severity-chapter-ground-truth.py` +
  `docs/specs/severity-chapter-ground-truth-results.md`

**FilterPanel.tsx:**
- Exclude `severity_class` and `statute_chapter` from the generic
  MultiSelect list (extend the existing dtp exclusion filter).
- In the Case group, directly after the DTP entry, render two entries
  using the exact dtp-entry markup: label `Severity` (summary from
  `severitySummary`), label `Statute chapter` (summary from
  `chapterSummary`); each opens its modal; active state = its column has
  selected values.
- Mount both modals conditionally at the bottom beside DtpFilterModal.

**notices.ts:** add: when `view.filters.severity_class` is non-empty AND
`view.history` is true AND the selection does not include
`Not graded (pre-2022)`, emit info notice — title
`Severity filter excludes 2006-2021`, detail
`The pre-2022 dataset is not graded for severity, so an active severity filter excludes all of it. Select "Not graded (pre-2022)" in the Severity filter to include those charges.`
Follow the existing notice objects' shape and tests if any.

**Ground truth:** `severity-chapter-ground-truth.py` (duckdb over the two
ASSEMBLED CSVs, not the parquets) prints labeled results for: severity
counts overall; severity x dtp_class YY; severity for court='Suffolk
Superior Court'; chapter counts top 10 + No statute code (recomputing the
chapter rule independently); history row count as the Not-graded count;
severity counts under filed_under='Hayden'. Write outputs into the
results markdown with the exact figures and a claims table mapping each
UI-displayed number class to its derivation. The reviewer of this task
runs the script.

**DESIGN.md:** one entry describing both filters, the modal pattern reuse,
the Not-graded constant decision, and the notice.

**Steps:** implement -> full `npx vitest run` + `npm run build` -> run the
ground-truth script into the results file -> commit
`Wire severity and chapter filters into the panel, add notice and ground truths`.

## Self-review notes

- Spec coverage: data layer + contract (done pre-plan, fa58746); entries,
  both modals, staged semantics, notice, ground truths, docs — Tasks 1-3.
  The adversarial gauntlet is run by the controller after Task 3, per the
  spec's Verification section; it is not a plan task.
- Type consistency: both modals take the DtpFilterModal prop shape;
  models export the names Task 2/3 import.
- No placeholders: all copy and titles are literal in this plan.
