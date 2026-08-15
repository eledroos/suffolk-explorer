# Severity and statute-chapter filters

2026-08-15. Directed by Nasser 2026-08-14 23:55: "Build #1 and #2 ... I'd
like to wake up to a working filter for severity and an easy way to see this
filtering on statute chapter. Be mindful that the filter options might have
long text so another method (including but not limited to a modal) might
work." Design decisions below are mine, made under that direction; the two
flagged questions at the end are his to answer in the morning and block
nothing.

## What ships

Two new charge-level filters, each surfaced through a modal entry in the
filter panel's Case group, directly below the Decline-to-prosecute entry and
following its interaction pattern (entry button, two-line active summary,
staged Apply/Cancel, live counts).

1. **Severity** — Felony / Misdemeanor / Civil infraction / Unclassified,
   plus "Not graded (pre-2022)" when the history dataset is on. Backed by
   the `severity_class` column built 2026-08-14 from the February 2026
   Master Crime List (see `../assembled/severity/`), which survived the
   four-angle adversarial review recorded in
   `../assembled/severity/reviews-2026-08-14/`.
2. **Statute chapter** — the MGL chapter parsed from `charge_code`
   ("c. 265", "c. 94C", ...), with official chapter titles, counts, and a
   link to each chapter on malegislature.gov. Handles the long-text problem
   with a searchable modal list, not a dropdown.

## Data layer

Both parquets gain two dictionary-encoded columns; the engine needs NO code
changes (merge.ts unions dictionaries by name; aggregate/filter/URL logic is
generic over cat columns).

- `severity_class`:
  - hayden.parquet: pass-through of the CSV column (Felony / Misdemeanor /
    Civil infraction / Unclassified; the prep gate asserts 100% non-null and
    that value counts equal the CSV's).
  - history.parquet: the constant **"Not graded (pre-2022)"**. The pre-2022
    file deliberately carries no severity (charge-time law differs; see the
    assembled README, limitation 8). A constant visible value beats null:
    nulls silently vanish from a severity chart or filter, which is this
    repo's documented NULL trap, while an explicit value keeps the 1.09M
    history rows visible and honestly labeled.
- `statute_chapter` (both files): derived from `charge_code` by one rule,
  identical in both prep scripts: `^([0-9]+[A-Z]?)/` on the trimmed code →
  "c. " + token; no match → **"No statute code"**. MassCourts dot-codes and
  catch-all codes (666666 etc.) land in "No statute code" by design; the
  rule is documented in both scripts. Display-ready values in the parquet
  follow the existing `filing_source` precedent ("Oct 2024 delivery").
- The Hayden CSV's `severity_source`, `mcl_offense_level`,
  `mcl_mandatory_time` also get dictionary encoding in prepare_data.py (they
  flow into the parquet regardless; encoding keeps it small). They are NOT
  added to the contract and have no UI.
- **Gates, printed and loudly failing, in each prep script**: chapter value
  counts recomputed independently from the CSV's charge_code must equal the
  parquet column's counts; Hayden severity counts must equal the CSV's;
  history severity must be the constant on every row. After any rebuild:
  `prepare_dtp_lists.py` regeneration (standing requirement) and the
  `dist/data/` copies.

## Contract change (sanctioned)

`contract.ts` COLUMNS gains, after `dtp_review`:

- `{ name: 'severity_class',  label: 'Severity',        kind: 'cat', filterable: true, groupable: true }`
- `{ name: 'statute_chapter', label: 'Statute chapter', kind: 'cat', filterable: true, groupable: true }`

This spec sanctions exactly these two additions, same as the dtp_review
precedent. Both columns therefore also appear in the X/series/grouping
dropdowns for free, which is the "easy way to see" part: severity and
chapter work as chart dimensions, not just filters.

## UI

### Filter panel entries

`FilterPanel.tsx` excludes the two new columns from the generic MultiSelect
list (same mechanism as dtp_class/dtp_review) and renders two entries in the
Case group below Decline-to-prosecute:

- "Severity" — opens SeverityFilterModal.
- "Statute chapter" — opens ChapterFilterModal.

Each entry follows the dtp-entry pattern exactly: chevron + label line;
muted "any" when inactive; accent dot + a wrapping two-line summary when
active ("Severity: Felony + 1 more", "Chapter: c. 265 + 2 more"; summary
functions live in the models). Active values also appear in the shared
Active chips row like every other filter.

### SeverityFilterModal

Card list in the DTP modal's visual language (checkbox, name, live count,
thin share bar, one plain sentence, expandable More with typed
paragraphs/facts/links):

- Cards: Felony, Misdemeanor, Civil infraction, Unclassified, and — only
  when `view.history` is true — Not graded (pre-2022). When history is off,
  a one-line footnote says the pre-2022 dataset is not graded and appears
  here only when included.
- Header: one short paragraph naming the source (the Massachusetts
  Sentencing Commission's Felony and Misdemeanor Master Crime List,
  February 2026 edition) with an external link to the Sentencing
  Commission's mass.gov page, and the felony test (punishable by state
  prison, G.L. c. 274 § 1) with an external link to the statute.
- Card copy discipline: every sentence must be traceable to the assembled
  README severity section, the reviews-2026-08-14 record, or the statute it
  cites. Load-bearing numbers go in fact chips, not prose, and each chip
  label must carry its scoping noun (the DTP v2 chip-label lesson). The
  Unclassified card says what the bucket actually holds (contingent
  offenses, pre-2018 amount language, catch-all codes) in one sentence.
- Counts: live, measure = charges, computed on the current view with the
  severity filter itself stripped (buildCountView semantics, reused from
  the DTP model generalized or mirrored; denominators are the same
  stripped view's total).
- Footer: Clear / Cancel / Apply, staged state, identical semantics to the
  DTP modal. Modal always opens with staged = applied state.

### ChapterFilterModal

A searchable list, not cards (71+ options):

- Provenance line: "Chapter parsed from each charge's statute code;
  [n] charges carry no parseable code." with the No statute code row
  pinned at the bottom of the unsearched list.
- Search box filtering on chapter number and title substring,
  case-insensitive.
- Rows sorted by count descending: checkbox · "c. 265" · official chapter
  title · right-aligned live count · thin share bar · external-link glyph
  to the chapter on malegislature.gov.
- **Official titles only.** The title strings ship in `chapterModel.ts` as
  a literal map covering every chapter present in either parquet, each
  title copied from malegislature.gov (e.g. c. 265 "Crimes Against the
  Person", c. 269 "Crimes Against Public Peace"; never editorial glosses
  like "Weapons"). The content review verifies every single title and link
  against the live site; a chapter whose title cannot be verified ships as
  number-only with no title rather than a guess.
- Link URL pattern: the implementer verifies one stable pattern
  (candidate: `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=265`)
  resolves in a real browser for a sample including lettered chapters
  (94C, 90C, 209A, 258E); if it fails, links are dropped for the failing
  chapters, never shipped dead.
- Long titles wrap; the row grid keeps checkbox/count/bar alignment.
- Staged Apply/Cancel/Clear, same footer as Severity.

### Notices

`noticesFor` gains one info notice: active `severity_class` filter + history
on + "Not graded (pre-2022)" not among the selected values → "Severity
filters exclude the 2006-2021 dataset (not graded). Select 'Not graded
(pre-2022)' in the Severity filter to include it."

### What is deliberately NOT in scope

- No seriousness-level or mandatory-minimum UI (34% / 2.3% fill; recorded
  as future work in the assembled README).
- No change to `crime_type` (see flagged question 2).
- No pre-2022 severity grading.
- No production push; the branch merges to master locally and Nasser
  decides deployment.

## Verification (the review gauntlet)

Per-task implementer + reviewer as usual, then repeated adversarial rounds
over the whole branch until two consecutive rounds produce zero Critical or
Important findings:

1. **Numbers**: a committed duckdb ground-truth script
   (`docs/specs/severity-chapter-ground-truth.py`) derives every displayed
   class of number independently from the assembled CSVs (not the
   parquets): severity counts overall and under sample filter combinations,
   chapter counts, No statute code count, history constant. A reviewer
   compares against the live DOM via playwright, including adversarial
   scenarios they invent (severity × DTP list, chapter × court, history on
   and off, % modes, cases measure with caseScope=all).
2. **Content**: hostile pass over every new sentence, chip, title, and
   link. Every chapter title and every external URL fetched and confirmed.
   Every severity-card claim traced to its named source.
3. **State machine**: staging attack list from the DTP v1 pass-3 review
   re-run against both new modals (apply/cancel/clear/reopen, URL
   round-trip byte-equality, chips-remove interaction, both modals open
   sequentially, history toggle mid-stage).
4. **UX/a11y**: keyboard-only run, dialog semantics, 390px, drawer mode,
   dark mode, long-title wrapping, search with zero results.
5. **Design**: impeccable polish pass (the repo's own skill) after
   functional reviews are clean.
6. **Regression**: full suite, build, clean-checkout install+test, DTP
   modal unaffected, bundle delta reported.

Findings loop per the DTP convention: hard gates on 1-3; fix rounds with
scoped re-reviews; all review records preserved under
`docs/reviews/2026-08-15-severity-chapter-filters/`.

## Commit convention

No AI attribution of any kind in commit messages in this repo.

## Flagged for Nasser (non-blocking)

1. **Production push**: everything merges to master locally; pushing to
   GitHub (and Cloudflare) is left for you.
2. **crime_type demotion**: tonight's analysis showed `crime_type` is
   case-inherited, not charge-level (the same 13M charge carries four
   different labels). Recommend flipping it to filterable:false like
   outcome_detail, relabeled "Case category (DAMION)". Not done without
   your say.
