# Round-2 content verification — severity-chapter-filters @ f3c20f4

Fresh-eyes review, no visibility into round-1's findings. `npm run test` scope
(severityModel.test.ts, chapterModel.test.ts): 28/28 pass.

## Item 1 — Master Crime List link (severityModel.ts:88)

**Verdict: PASS.**

`href: 'https://www.mass.gov/doc/master-crime-list'`. WebFetch 403'd (mass.gov
blocks the automated fetcher); loaded it in the real Playwright browser
instead, per instructions.

- Browser tab title: **"Master Crime List 2015 | Mass.gov"**
- On-page H1: "Master Crime List"
- Page metadata table: Last Updated **2026-03-30**; Contributing Organizations
  "Massachusetts Sentencing Commission, Massachusetts Court System"
- Opened the linked PDF (`/doc/master-crime-list/download`) directly in the
  browser (curl was blocked with a bot-detection "Not allowed" page, so this
  had to go through the real browser tab, not curl). The PDF's title page
  reads: **"Felony and Misdemeanor Master Crime List by M.G.L. Reference /
  Advisory Sentencing Guidelines / February 2026"** — confirms the header
  copy's "(February 2026 edition)" claim exactly.
- Link label is `'The Master Crime List (mass.gov)'` — accurately describes
  the destination (name + domain), independent of the stale tab title.

One thing worth knowing but not a code defect: the HTML `<title>` tag on that
mass.gov page still says "2015" even though the document behind it was
replaced with the Feb 2026 edition (last-updated 2026-03-30). That's mass.gov's
CMS leaving a stale `<title>` on a URL whose attached PDF gets swapped out
periodically — the explorer doesn't scrape or display that title anywhere, so
it does not propagate into the app. Flagging only so nobody is confused if
they check the tab title themselves and see "2015."

## Item 2 — G.L. c. 274 § 1 link (severityModel.ts:92-95)

**Verdict: PASS.**

Fetched `https://malegislature.gov/Laws/GeneralLaws/PartIV/TitleI/Chapter274/Section1`
directly (this one wasn't blocked). Statute text: "A crime punishable by death
or imprisonment in the state prison is a felony. All other crimes are
misdemeanors." This matches the header's claim word for word in substance:
"a crime punishable by imprisonment in state prison is a felony ...; every
other crime is a misdemeanor." The header omits "or death," which is
immaterial (Massachusetts has no operative death penalty; Colon-Cruz, 1984)
and doesn't misstate the test.

## Item 3 — MISCODED_TOKENS ('258', '279C', '269C') (chapterModel.ts)

**Verdict: PASS.**

Code check: `CHAPTER_RE`/`tokenFromValue`/`chapterHref` in chapterModel.ts
correctly derive the token from the stored `"c. XXX"` value and
`chapterHref` returns `null` whenever the token is in `MISCODED_TOKENS =
{'258','279C','269C'}`. None of the three appear as keys in `CHAPTER_TITLES`
either, so `chapterTitle()` is null for them too. `chapterModel.test.ts`
pins both (`returns no link` / `still returns no title`) and both pass.

Cross-checked the three factual claims in the header comment against
`data/assembled/severity/severity-rulings.csv` and the raw assembled CSVs:

- **258/9** — `severity-rulings.csv:22`: `"258/9","HARASSMENT PREVENTION
  ORDER, VIOLATE C258 §9",...,"the statute is c.258E s.9 ...; DAMION
  truncates the chapter to 258"`. Confirms: real chapter is 258E, DAMION
  truncates to 258. Matches the claim exactly.
- **279C/25** — `severity-rulings.csv:93`: `"279C/25","HABITUAL OFFENDER
  C279 §25",...,"c.279 s.25 applies on a felony conviction..."`. Confirms:
  real chapter is 279, DAMION miscodes it 279C. Matches.
- **269C** — does **not** appear in `severity-rulings.csv` at all (that file
  only covers codes present in the 2022-2025 Hayden-era severity curation,
  and 269C/10 doesn't occur in `hayden-era-charges-2022-2025.csv`). It does
  occur in `pre-2022-composite.csv` (2 rows, code `269C/10`, description
  `"ARMED CAREER CRIMINAL c269 §10"` — note the description's own citation
  says "c269," not "c269C"), which independently corroborates the claim that
  269C is a miscoding of chapter 269, not a real chapter. This is
  circumstantial (not a severity-rulings.csv ruling), but it's the only
  direct evidence available and it supports the header comment.

No factual problem found. One documentation-precision note: the code comment
says "269 as 269C" in general, but per the raw data the miscoding is narrower
— specifically the Armed Career Criminal charge code `269C/10` — the same
scope as 279C (one specific enhancement code), not a general 269-vs-269C
DAMION-wide pattern the way 258→258E is. Not incorrect, just worth knowing if
someone later tries to independently verify "269 as 269C" and only finds one
code family in the data.

## Item 4 — Fresh hostile read of the five cards + provenance line

Verdict: **four of five card blurb/detail pairs hold up; one internal
tension found (new, Minor).** Chapter provenance line: clean.

- **Felony** — blurb ("Crimes punishable by imprisonment in state prison")
  matches c.274 §1 exactly (see item 2). Detail's repeat-offense claim reads
  as a methodology note about this project's own grading rule, not an
  external legal claim; spot-checked against a repeat-offense row in
  `severity-rulings.csv` (269/10/B "SECOND OR SUBSEQUENT...LARGE CAPACITY
  FIREARM," graded Felony, basis: "a second-or-subsequent offense cannot
  grade lower") and it's consistent.
- **Misdemeanor** — **NEW FINDING (Minor):** the blurb says "Every other
  crime; the maximum sentence runs in a house of correction," and the very
  next sentence in the detail says "Fine-only crimes are misdemeanors too."
  A fine-only crime has no house-of-correction sentence at all — the maximum
  sentence is the fine, full stop. Read back to back, the blurb's
  unqualified "the maximum sentence runs in a house of correction" is
  contradicted by the detail it sits next to. The intended reading (if any
  custodial sentence exists it caps at HOC, not state prison) is a common
  shorthand among practitioners, but a literal reader hits a contradiction
  within two sentences. This blurb predates round 1 (unchanged since the
  card was first written; round 1 only touched `chapterModel.ts` and the
  Master Crime List href in `severityModel.ts`), so it's a pre-existing gap
  round 1 didn't cover, not a regression.
  The unlicensed-operation-of-MV claim in the same detail paragraph ("chapter
  90C expressly keeps it a crime") was independently verified against
  G.L. c. 90C § 1's definition of "civil motor vehicle infraction," which
  explicitly excepts "operation of a motor vehicle in violation of the first
  paragraph of section 10 of chapter 90" from civil treatment — the claim is
  correct.
- **Civil infraction** — no issues; cross-checks cleanly with the Misdemeanor
  card's c.90C claim above (two different questions — civil-vs-criminal
  under c.90C, felony-vs-misdemeanor under c.274 §1 — correctly kept
  separate).
- **Unclassified** — no issues; the "$250 to $1,200 in 2018" larceny-line
  claim it shares with the next card is addressed below.
- **Not graded (pre-2022)** — no internal issues. The $250→$1,200 (2018)
  larceny-threshold claim: independently confirmed the *current* $1,200
  figure by fetching G.L. c. 266 § 30 directly ("if the value of the
  property stolen exceeds $1,200 ... state prison ... does not exceed $1,200
  ... imprisonment in jail"). Could not re-verify the *historical* $250
  figure or the 2018 date against a second source — WebSearch was
  unavailable this session (budget exhausted). This is a well-established
  public fact (the 2018 Criminal Justice Reform Act, St. 2018 c. 69, raised
  the felony larceny threshold from $250 to $1,200) and nothing in the
  sources I could reach contradicts it, so I'm not flagging it as a finding,
  but per the repo's own fact-checking convention it should be logged as
  **not independently re-verified this pass** rather than silently treated
  as confirmed.

**Chapter provenance line** (`chapterModel.ts` `CHAPTER_PROVENANCE`):
"Chapter parsed from each charge's statute code. Charges whose code carries
no chapter (catch-all and legacy codes) are grouped under 'No statute
code'." Matches `prepare_data.py`/`prepare_history.py`'s actual regex
derivation (`CHAPTER_RE = r"^([0-9]+[A-Z]?)[/.]"`, fallback `"No statute
code"`) exactly. No issue.

**Chapter titles spot-check:** round 1 corrected two titles (127, 62C) per
`git show 6c877bd`. Verified both against malegislature.gov directly:
- c. 127 → "OFFICERS AND INMATES OF PENAL AND REFORMATORY INSTITUTIONS.
  PAROLES AND PARDONS" — matches `CHAPTER_TITLES['127']` exactly.
- c. 62C → "ADMINISTRATIVE PROVISIONS RELATIVE TO STATE TAXATION" — matches
  `CHAPTER_TITLES['62C']` exactly.
- Also spot-checked c. 90C ("Procedure for Motor Vehicle Offenses" —
  matches) since it's cited in the Misdemeanor card's prose, not just the
  chapter list.
No regression in either corrected title or in the surrounding entries.

## Item 5 — DESIGN.md's severity/chapter feature entry (lines 76-104)

**Verdict: PASS.**

- "the coverage.ts registry" claim: confirmed. `src/engine/coverage.ts` has
  `id: 'severity-excludes-history'`, `banner: true`, no `band` key present
  (banner-only, as described), `when: (view) => { const sel =
  view.filters['severity_class'] ?? []; return view.history === true &&
  sel.length > 0 && !sel.includes('Not graded (pre-2022)'); }` — reads
  `view.filters.severity_class` and `view.history` exactly as DESIGN.md
  says, and follows the same `when`-clause pattern as `superior-gap` (reads
  `view.filters['court']`) and `disp-2021-snapshot`/`both-lens-split-rows`
  (read `view.history`), also as claimed.
- Modal file claims: `SeverityFilterModal.tsx` + `severityModel.ts` and
  `ChapterFilterModal.tsx` + `chapterModel.ts` both exist at the stated
  paths. `filterEntries.ts` has `isDedicatedModalCol` as named.
- "reusing the Decline-to-prosecute entry's exact dtp-entry markup and
  staged Apply/Cancel modal pattern" — plausible given `DtpFilterModal.tsx`
  exists alongside the two new modals and the shared model-file structure
  (severityModel.ts/chapterModel.ts mirror dtpModel.ts's summary/normalize
  function shapes almost line for line), not independently re-verified pixel
  by pixel — out of scope for a content-verification pass.
- Ground truth reference (`docs/specs/severity-chapter-ground-truth.py` and
  results file) and spec path exist as named; not re-run (out of scope —
  this is a content/copy verification, not a data-recompute pass).

## Summary

| # | Item | Verdict |
|---|------|---------|
| 1 | Master Crime List link | PASS — resolves, page confirms Feb 2026 edition PDF, label accurate |
| 2 | c. 274 § 1 link/claim | PASS — statute text matches header's felony test verbatim in substance |
| 3 | MISCODED_TOKENS (258/279C/269C) | PASS — code correct, all three claims corroborated by data |
| 4 | Five cards + provenance, fresh read | 4/5 clean; 1 NEW finding (Minor) below |
| 5 | DESIGN.md feature entry | PASS — coverage.ts registry and modal claims all accurate |

### New findings this pass

1. **[Minor]** `src/ui/severityModel.ts` — Misdemeanor card: blurb "the
   maximum sentence runs in a house of correction" is contradicted, two
   sentences later, by the detail's "Fine-only crimes are misdemeanors too"
   (a fine-only crime has no HOC sentence at all). Pre-existing, not touched
   by round 1. Suggested fix: qualify the blurb, e.g. "Every other crime;
   any custodial sentence runs in a house of correction, not state prison"
   or move the fine-only carve-out into the same sentence as the HOC claim.

2. **[Informational, not a defect]** The mass.gov page at
   `/doc/master-crime-list` carries a stale `<title>` of "Master Crime List
   2015" even though the linked PDF was replaced with the Feb 2026 edition
   (Last Updated 2026-03-30 per the page's own metadata table). Doesn't
   affect the app since nothing scrapes that title, but noted in case anyone
   re-checks the link by eyeballing the browser tab and gets confused.

3. **[Informational, gap not failure]** The larceny threshold history
   ("$250 to $1,200 in 2018") appearing in both the Unclassified and Not
   graded (pre-2022) cards could not be independently re-verified this pass
   — WebSearch budget was exhausted session-wide before I could pull a
   second source. Current $1,200 figure is confirmed directly against
   G.L. c. 266 § 30. The historical $250 figure and 2018 date are
   well-established public record and nothing found contradicts them, but
   per the repo's own convention this should be logged as
   not-independently-reverified rather than silently treated as checked.
