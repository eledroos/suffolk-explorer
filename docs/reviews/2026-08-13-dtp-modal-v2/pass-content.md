# Pass: content (DTP modal v2), adversarial

Branch `dtp-modal-v2`, HEAD `592ecec`. Attacked only what v2 introduced or
changed: fact chips, reflowed sentences, the caveat after its README sentence
was cut, the XLSX About sheet, the Browse tab's provenance line and chips and
headers, the memo link, the header sentence plus its new link, and dashes.

Every number below was re-derived here, not read out of
`docs/specs/dtp-ground-truth-results.md`. Tools: duckdb 1.5.5 against
`public/data/hayden.parquet` and `public/data/history.parquet`, openpyxl
against `../suffolk-package/reference/SCDAO-DTP-Classification.xlsx` and the
committed `public/downloads/suffolk-dtp-lists.xlsx`, `curl` and `pdfinfo` and
`pdftotext` against the memo URL.

**16 findings: 2 Critical, 9 Important, 5 Minor.**

---

## Critical

### C1. The chip "Share of 2006-2021 charges = about 6%" is wrong under its own label, and the card beside it says so

`src/ui/dtpModel.ts`, `dtp_class` "Not listed" card.

The 6% comes from every row in `history.parquet`: 63,555 of 1,092,889 = 5.82%.
That file's filing dates run 1999-01-01 to 2022-01-12, not 2006-2021. Charges
actually filed 2006-2021, which is what `filed_in_window` marks in that file
and what the chip's label says, give a different answer:

```sql
-- history.parquet
SELECT sum(dtp_class='Not listed'), count(*) FROM history WHERE filed_in_window;
-- 18,957 / 874,107 = 2.17%
SELECT sum(dtp_class='Not listed'), count(*) FROM history;              -- all rows
-- 63,555 / 1,092,889 = 5.82%
SELECT count(*) FROM history WHERE NOT filed_in_window;                 -- 218,782
SELECT sum(dtp_class='Not listed') FROM history WHERE NOT filed_in_window; -- 44,598 (20.4%)
```

The 6% is a property of the 218,782 rows filed outside 2006-2021, where the
Not listed rate is 20.4%. Attributing it to "2006-2021 charges" overstates by
nearly three times.

It also contradicts the card it sits on. With the history toggle on and the
Filings lens, the "Not listed" card's own count and denominator are
20,833 of 1,035,241, which is 2.0%. The reader sees 2.0% on the card and
"about 6%" on the chip inside it.

"2006-2021" means `filed_in_window` in every other place v2 uses it: the
sidebar's "Include 2006-2021" and "filings 2006-2021", the Browse tab's
"Filed 2006-2021" column, and the XLSX's "Charges filed 2006-2021" column
(that column is built with `WHERE filed_in_window`, so it is correct). This
chip is the only place the phrase means something else.

Cause: the v1 sentence read "about 6% of the charges in the pre-2022 file",
scoped to the file, and Task 7 row 12 verified it that way ("all rows in each
file"). Task 2's relocation turned the file into a date range and nobody
re-derived the number under the new scope. The companion chip survives only by
luck: `hayden` all rows is 1.06% and `hayden` filed 2022-2025 is 1.16%, and
both round to "about 1%".

**Fix, one of two, not a mix.** Keep the file scope:

- `{ label: 'Share of the 2022-2025 file', value: 'about 1%' }`
- `{ label: 'Share of the pre-2022 file', value: 'about 6%' }`

Or keep the date ranges and use the filed-in-window figures:

- `{ label: 'Share of 2022-2025 charges', value: 'about 1%' }`
- `{ label: 'Share of 2006-2021 charges', value: 'about 2%' }`

### C2. The XLSX ships a 69-row sheet called "Decline list (YY)" with the office's name on it and none of the corrections the modal carries

`public/downloads/suffolk-dtp-lists.xlsx`, About sheet, verified by opening
the committed file.

Sheet names: `About`, `All lists` (1,300 rows), `Decline list (YY)` (69),
`Presumption against (NY)` (107), `Case-by-case (NS)` (627),
`Ordinarily prosecuted (NN)` (497).

About paragraph 1: "This workbook lists every charge description in the
Suffolk County District Attorney's office's decline-to-prosecute
classification: which of four categories ... the office's worksheet assigns to
it."

Two defects, one file:

1. It attributes the classification to the office as an instrument. The modal
   copy was rewritten in Task 7 to stop doing exactly this (pass-2's C-level
   finding), and says "a worksheet created inside the District Attorney's
   office in 2020". The About sheet says "the office's ... classification" and
   "the office's worksheet".
2. The 69-versus-46 correction is absent. Nothing in the workbook says the
   memo's operative list is 46 descriptions, that the YY tab is broader, or
   that the extras include drug distribution charges the worksheet's own
   annotation column marks `NOT IN MEMO AND WOULD NOT ADD` (verified: 9 of
   the 10 conflict rows carry that annotation verbatim at `YY REVIEW` rows
   163 to 174). The modal carries all of it. The XLSX carries none of it, and
   the XLSX is the artifact that leaves the site.

A reporter who downloads this file has a spreadsheet named for the DA's office
containing a 69-row sheet titled "Decline list (YY)" and no way to learn that
the published list is 46.

**Fix.** In `scripts/prepare_dtp_lists.py`'s `about_lines`:

- Paragraph 1: "This workbook lists every charge description in a
  decline-to-prosecute classification worksheet made inside the Suffolk County
  District Attorney's office: which of four categories, decline (YY),
  presumption against (NY), case-by-case (NS), or ordinarily prosecuted (NN),
  the worksheet assigns to it."
- Add a bolded "The decline list (YY) sheet is broader than the published
  list." section: "The worksheet's YY tab holds 69 charge descriptions. The
  list published in the March 2019 policy memo is 46 of them. The extras
  include drug distribution charges the worksheet's own annotations mark 'not
  in memo and would not add'. The worksheet records no adoption of anything
  beyond the memo's list."

---

## Important

### I1. Chip "Charges marked agreed = 76" contradicts the count on its own card

`dtp_review` "Proposed and agreed, never adopted" card. The card's badge reads
the view's charge count, 28,482 under the Filings lens. Inside it a chip says
"Charges marked agreed 76".

76 is the worksheet's own parenthetical in the section header
`DTP PROPOSED NEW CHARGES AGREED (76 new)`, a count of base offenses. The
section itself holds 107 rows (verified by counting non-empty column-A rows
between the section headers at `YY REVIEW` rows 50 and 159). So 76 counts
charge types, and everywhere else in this UI "charges" counts rows.

**Fix.** `{ label: 'Charge types marked agreed', value: '76' }`.

### I2. Chip "Charge descriptions = 69" is not self-sufficient, and reads false against the data on the card

`dtp_class` YY card. Card name "On the decline list", badge 39,106 charges,
then a chip reading "Charge descriptions 69". Chips render above the
paragraphs in `DtpFilterModal.tsx`, so the sentence that would say "on the
worksheet's YY tab" arrives after.

Read as a property of the data on the card, the chip is wrong:

```sql
SELECT count(DISTINCT charge_description) FROM hayden
WHERE filed_in_window AND dtp_class LIKE 'YY%';   -- 61
```

61, not 69, in the 2022-2025 file. (History's window happens to be 69, which
makes the misreading look confirmed with the toggle on.) The verified fact,
69 strings on the worksheet's YY tab, is right; the label drops the noun that
makes it true.

**Fix.** `{ label: 'Descriptions on the worksheet YY tab', value: '69' }`.

### I3. The same 46 wears two labels in one modal

"Operative list = 46" on the YY card, "Operative charge descriptions = 46" on
the Current list card. One quantity, two names, one screen. "Operative list =
46" also carries no unit, so it reads as a list identifier as easily as a
count.

**Fix.** Use `Operative list descriptions` = 46 in both cards.

### I4. Chips "Raw rows = 17" and "Strings after precedence = 16" are build-script vocabulary

`dtp_review` "Proposed, rejected" card. Both numbers are correct (17 rows
under `DTP PROPOSED NEW CHARGES DISAGREE (17)`; 16 after the
current-beats-disagreed precedence). But "raw rows" and "precedence" are terms
from `load_review()`, and they render above the paragraph that explains them.

**Fix.** `{ label: 'Rows in the rejected section', value: '17' }` and
`{ label: 'Descriptions left after the current list wins', value: '16' }`.

### I5. The caveat now renders on both tabs, so "the decline-list tags above" points at nothing on the Review status tab

`DtpFilterModal.tsx`'s `renderSection()` calls `renderCaveat()` for both
`class` and `review`. On the Review status tab, the cards above the caveat are
Current list, Proposed and agreed, Proposed rejected, and Not reviewed. None
of them is a decline-list tag.

In v1 (`git show 50666de:src/ui/DtpFilterModal.tsx`) both sections rendered
stacked in one scrolling modal and the caveat rendered once, guarded by
`idx === 0`, directly under the decline-list cards. "Above" was true. Splitting
the sections into tabs broke the referent and duplicated the paragraph. This
is the one paragraph carrying the modal's main qualification, and CLAUDE.md's
rule is that every demonstrative gets exactly one possible referent.

**Fix.** Render the caveat on the Decline list tab only. If it must appear on
both, change the third sentence to "The decline-list tags on the other tab
come from the classification's broader YY tab."

### I6. The Browse tab marks three rows "Rejected" that the worksheet records as a deferral, and one the worksheet partly agreed with

`dtpBrowse.ts` maps every `Proposed, disagreed` row to the chip "Rejected".
The workbook's annotation column, `YY REVIEW` rows 160 to 176, read verbatim:

```
row160  NIGHTWALKER, COMMON c272 §53                    HTU needs to be consulted
row161  NIGHTWALKER, COMMON, 3RD OFFENSE c272 §53       HTU needs to be consulted
row162  STREETWALKER, COMMON c272 §53                   HTU needs to be consulted
row168  DRUG, DISTRIBUTE OR POSSESS WITH INTENT CLASS D  PWID in memo and agree,
                                                         Distribution not in memo and
                                                         would not add at this time
row175  SEXUAL CONDUCT FOR FEE c272 §53A                No
row176  PROSTITUTE, SOLICIT FOR c272 §8                 No
(the remaining 11 read NOT IN MEMO AND WOULD NOT ADD, or a bare N)
```

All four of those rows render in the Browse table with a "Rejected" chip.
Row 168 is also one of the 10 conflict rows, so its flag tooltip ("Tagged on
the decline list (YY), but the review tab's response was Rejected") asserts
the opposite of what the worksheet says for that row. The modal's own
Proposed-rejected card documents both exceptions. The Browse tab, which is the
first place these strings are visible one at a time, drops them.

**Fix.** Use the worksheet's word: `'Proposed, disagreed': 'Disagreed'`, which
is true of the section for all 17 rows. Change the flag tooltip to "Tagged on
the decline list (YY), and the review tab put this description in its
disagreed section. Both tags are shown as recorded in the worksheet."

### I7. The Browse tab's provenance line was written for a file and renders as page prose

`source_note` in `public/data/dtp-lists.json`, rendered verbatim by
`DtpBrowseTab.tsx`: "... This file and the XLSX beside it are derived; the
original worksheet is not distributed."

On screen there is no "this file", and no XLSX "beside it"; there is a
download button above the sentence. The referent has no on-screen target.

**Fix.** "Derived from a classification worksheet created inside the Suffolk
County District Attorney's office in 2020, applied to charge-level records by
charge description. The lists below and the XLSX download are derived from
that worksheet. The worksheet itself is not distributed."

### I8. Nothing says the Browse counts ignore the reader's filters, or which data produced them

`Filed 2022-2025` and `Filed 2006-2021` are computed once by
`prepare_dtp_lists.py` over `hayden.parquet` and `history.parquet`
`filed_in_window` rows. They do not move with lens, date range, court, or any
other filter, while every card one tab away is captioned "of N charges in the
current view". A reader who filters to Boston Municipal Court and clicks
Browse gets unfiltered numbers and no notice.

The XLSX is worse: the About sheet never names the datasets behind the two
count columns at all. "charge-level data" is as specific as it gets.

**Fix.** Append to the provenance line: "Counts cover every charge filed in
each window across both datasets, not the current view." In the About sheet,
name the two files and their windows.

### I9. The XLSX About sheet points at "Conflicts" rows the workbook does not label

About paragraph: "The 'Conflicts' rows in the 'All lists' sheet are these
charge descriptions: 10 distinct descriptions, covering 2,393 charges filed
2022 to 2025."

There is no Conflict column, no highlight, and no Conflicts sheet. Every data
sheet's header is exactly `Description, Class, Review tier, Charges filed
2022-2025, Charges filed 2006-2021`. A reader is told where the rows are and
cannot find them. The numbers themselves hold: the 10 rows' `n_2022_2025`
values sum to exactly 2,393.

Severity as a reader: this is the one paragraph in the file that flags a
problem with the data, and following it dead-ends.

**Fix.** Either add a `Conflict` column (`yes` or blank), or state the recipe:
"These are the rows where Class is 'YY (decline list)' and Review tier is
'Proposed, disagreed': 10 descriptions, 2,393 charges filed 2022 to 2025."

---

## Minor

### M1. Review tier values are never defined, and blank is ambiguous

The XLSX's Review tier column carries `Current list`, `Proposed, agreed (never
adopted)`, `Proposed, disagreed`, and blank for 1,131 of 1,300 rows. The About
sheet glosses none of them. Same blank in the Browse tab's Review column,
where a reader cannot tell "not reviewed" from "data missing".
**Fix.** One About line defining the three tiers and the blank, and a clause
in the Browse provenance line: "A blank review means the 2020 review never
covered that description."

### M2. The reflow swapped the worksheet's word for an editorial one

YY card paragraph 3 moved from "descriptions the review tab lists as
proposed-but-disagreed" to "descriptions the review tab rejected". True for 9
of the 10 conflict descriptions, which is 2,391 of the 2,393 charges; the
tenth is the row the worksheet partly agreed with (I6).
**Fix.** "descriptions the review tab put in its disagreed section."

### M3. "this project's tagging preserves it"

`DTP_CAVEAT.text`. "This project" is never named anywhere in the modal.
**Fix.** "the tagging here preserves it."

### M4. The Browse tab's loading and error state shows a different provenance sentence

`DtpBrowseTab.tsx` falls back to "A classification worksheet from inside the
Suffolk County District Attorney's office, 2020, applied to charge-level
records by charge description," which drops the derived-and-not-distributed
disclosure that `source_note` carries. Transient, but it is what a slow
connection shows.
**Fix.** One string, used in both states.

### M5. Arriving on Browse through the caveat link, the only explanation of the 10 rows is a title attribute

The deep link lands on the Conflicts chip with 10 rows and a flag glyph whose
meaning lives in `title` and `aria-label`. No hover on touch.
**Fix.** When the conflicts chip is active, render one line above the table
naming what the flag means.

---

## Survives

- **The memo URL.** Fetched independently on 2026-08-13:
  `HTTP/2 200`, `content-type: application/pdf`,
  `memento-datetime: Tue, 26 Mar 2019 18:38:22 GMT`,
  `x-archive-orig-server: cloudflare` from
  `suffolkdistrictattorney.com`'s own `/wp-content/uploads/2019/03/` path.
  Downloaded 42 MB. `pdfinfo`: **66 pages**, CreationDate Mon Mar 25 16:01:51
  2019. `pdftotext` page 1: "THE R A C H A E L / ROLLINS / POLICY MEMO /
  MARCH 2019". The PDF also contains "The list of 15 offenses identified for
  declination and diversion are included in the ...", which is the source of
  the Current list card's "Memo offenses = 15" chip. Target, date, page count
  and the chip it backs all hold.
- **The header sentence plus its new link (surface 7).** "published a list"
  links to the memo, which is where the list is. The next sentence dates the
  classification to 2020 and calls it a classification. Two dates and two
  nouns keep the memo and the worksheet apart; a hostile reader cannot get to
  "the 2020 classification is the memo" without ignoring both. One
  non-blocking note: "a 2020 office classification" promotes a worksheet to an
  office instrument, where the detail paragraph says "a worksheet created
  inside the District Attorney's office in 2020". If it is cheap, "how a 2020
  classification worksheet made inside the office treats its charge type"
  closes the gap.
- **"The Browse tab flags the conflicting rows."** True in the shipped UI.
  `public/data/dtp-lists.json` carries 10 rows with `"conflict": true`, all
  class `YY (decline list)` and review `Proposed, disagreed`;
  `DtpBrowseTab.tsx` renders each with a flag glyph and a row class, and
  `BROWSE_CHIPS` carries a Conflicts chip. Their `n_2022_2025` values sum to
  2,393, matching the sentence's own figure.
- **The caveat's link promise.** "See the conflicting rows" switches to tab 3
  with the Conflicts chip seeded, showing those 10 rows. Promise kept.
- **DTP_CAVEAT standing alone without the README sentence.** Three sentences,
  self-contained claim, and the cut citation's job is taken over by the link.
  It stands, apart from the "above" referent (I5) and "this project" (M3).
- **Every chip value.** Re-derived: workbook `YY REVIEW` sections give 46
  current, 107 agreed rows, 17 disagreed rows; the `YY` tab gives 69 strings;
  16 disagreed strings survive the current-beats-disagreed precedence; the
  memo gives 15 offenses; `hayden.parquet` gives 2,393 charges. Only the
  labels are wrong (C1, I1, I2, I3, I4), not the arithmetic.
- **The JSON's provenance facts.** "created inside the Suffolk County District
  Attorney's office in 2020" matches the workbook's `docProps/core.xml`
  (creator `Constantino, Bobby (SUF)`, created 2020-08-11).
- **Dash sweep.** No em dash, en dash, figure dash, horizontal bar or minus
  sign anywhere in `dtpModel.ts`, `dtpBrowse.ts`, `DtpBrowseTab.tsx`,
  `DtpFilterModal.tsx`, `FilterPanel.tsx`, `prepare_dtp_lists.py`,
  `public/data/dtp-lists.json` (all 1,300 rows, so the descriptions are clean
  too), or the XLSX's About text and headers. Every range uses an ASCII
  hyphen. Out of scope but noted: `src/ui/AboutModal.tsx` lines 21 and 58 hold
  en dashes, untouched by v2 and pre-existing.
- **Committed asset parity.** `dist/data/dtp-lists.json` and
  `dist/downloads/suffolk-dtp-lists.xlsx` are byte-identical to their `public/`
  sources, so the audited text is the shipped text. Only the `public/` copies
  are tracked by git.

## Bottom line

The v2 numbers are right and the memo link is real. The v2 *labels* are what
break: shortening sentences into chips dropped the nouns that made three of
them true, and C1 turned a file-scoped share into a date-scoped one that is
wrong by a factor of three and contradicts the card printing it. The XLSX
carries the office's name and a 69-row "Decline list" without any of the
corrections the modal spent Task 7 adding, and it is the copy that travels.
Fix C1 and C2 before ship; I1 through I9 are all one-line copy edits.

---

# Re-review

Fix wave read at `aa5b3fc` and `74b87e9`, against the fixer's
`fixwave-report.md` and the current files. Everything below was re-derived
here, not taken from the fixer's report.

**Independent checks run first.**

- `scripts/prepare_dtp_lists.py` re-run against the committed workbook and
  parquets, with `OUT_JSON` and `OUT_XLSX` redirected into a scratch directory
  so the tree stayed clean: **16 of 16 gates PASS**, "all gates passed. 1300
  rows." The regenerated JSON is byte-identical to the committed
  `public/data/dtp-lists.json`; the regenerated XLSX differs from the
  committed one in `docProps/core.xml` alone (openpyxl's created and modified
  timestamps). Every sheet XML compares equal. The committed assets are what
  the committed script produces.
- Committed XLSX opened with openpyxl: all sixteen About lines read back, six
  sheets, headers `Description, Class, Review tier, Charges filed 2022-2025,
  Charges filed 2006-2021`, row counts 1,300 / 69 / 107 / 627 / 497.
- `npm run test`: **84 passed (84)**, 3 files.
- Dash sweep over `dtpModel.ts`, `DtpBrowseTab.tsx`, `dtpBrowse.ts`,
  `DtpFilterModal.tsx`, `prepare_dtp_lists.py`, the committed
  `dtp-lists.json`, and every cell of the committed XLSX including the new
  About text: **no hits** for em dash, en dash, figure dash, non-breaking
  hyphen, horizontal bar, minus sign, small or fullwidth hyphen.

## Verdicts

| # | Verdict | Evidence |
|---|---|---|
| C1 | **ADDRESSED** | Labels are file-scoped again. Re-derived: `hayden.parquet` all rows 2,124/200,630 = 1.06% for "Share of the 2022-2025 file"; `history.parquet` all rows 63,555/1,092,889 = 5.82% for "Share of the pre-2022 file". Both true under their own labels, and the pair now uses one population rule. "the pre-2022 file" resolves on screen: the same card's paragraph 2 already says "The pre-2022 file carries 1,079 distinct unmatched descriptions" |
| C2 | **ADDRESSED** | About sheet regenerated and read back. Title and paragraph 1 now say "a decline-to-prosecute classification worksheet made inside the ... office", not "the office's ... classification". New bolded section carries 69 versus 46, the drug-distribution annotation and the no-adoption line. Verified its arithmetic independently against the JSON: all 46 `Current list` rows are class YY, and the `Decline list (YY)` sheet's 69 rows split 46 `Current list` / 10 `Proposed, disagreed` / 13 blank, so "the narrower set of 46, the rows marked 'Current list' in the Review tier column" is literally true of that sheet |
| I1 | **ADDRESSED**, new breakage **NB1** | "Charges" is gone. "Charge types marked agreed = 76" asserts a grouping the source does not carry. See NB1 |
| I2 | **ADDRESSED** | "Worksheet YY strings = 69". Re-verified: the `YY` tab holds 69 strings. The label now names the worksheet, so the data misreading (61 distinct YY descriptions in the 2022-2025 file) is no longer invited. "strings" is jargon but matches the caveat's own "46-string list" |
| I3 | **ADDRESSED** | "Operative list strings = 46" on both the YY card and the Current list card |
| I4 | **ADDRESSED**, new breakage **NB2** | Build-script vocabulary is gone. "Distinct strings = 16" is false as written. See NB2 |
| I6 | **DEFERRED-WITH-RULING (R8)**, new breakage **NB3** | Tooltip half applied and now true of all 10 conflict rows, including the row the worksheet partly agreed with. The `Rejected` chip is unchanged per the ruling, so `NIGHTWALKER, COMMON`, `NIGHTWALKER, COMMON, 3RD OFFENSE`, `STREETWALKER, COMMON` ("HTU needs to be consulted") and the PWID row still read "Rejected" in the Review column. New wording introduces NB3 |
| I5 | **ADDRESSED** | `DTP_CAVEAT` drops "above". Read on the Review status tab, every sentence now stands without a pointer: "The decline-list tags come from the classification's broader YY tab; the operative 46-string list is the narrower set under Review status." |
| I7 | **ADDRESSED** | Committed `source_note` reads "The data behind this view is derived from ... The table and the downloadable spreadsheet are derived; the original worksheet is not distributed." Both nouns are on screen |
| I8 | **ADDRESSED**, new breakage **NB4** | XLSX section "Where the two count columns come from" is accurate and names both files and both windows. The UI's added sentence overstates. See NB4 |
| I9 | **ADDRESSED** | Recipe verified against the shipped workbook, not the script: rows with Class `YY (decline list)` and Review tier `Proposed, disagreed` number 10, and their `Charges filed 2022-2025` sum to exactly 2,393 |
| M1 | **ADDRESSED** (About half) / **DEFERRED-WITH-RULING (R9)** (Browse half) | About line 6 defines all three tiers and the blank. The Browse column's blank is still unexplained, deferred because R9 caps the provenance line at one added sentence |
| M2 | **ADDRESSED**, new breakage **NB5** | YY card paragraph 3 now reads "descriptions the review tab put in its disagreed section", true of the section for all 17 rows. The caveat's identical claim was left in the old wording. See NB5 |
| M3 | **ADDRESSED** | "the tagging here preserves it" |
| M4 | **ADDRESSED** | `PROVENANCE_FALLBACK` mirrors `SOURCE_NOTE`, so the loading and error states carry the same disclosure |
| M5 | **DEFERRED-WITH-RULING (R11)** | Needs markup and a style rule. The flag's title and accessible name (I6) plus the caveat sentence that deep-links there carry the meaning in the meantime. Reasonable |

**14 addressed, 2 deferred with a ruling (I6 chip half, M5), 1 split (M1).**

## New breakage: 5 (2 Important, 3 Minor)

### NB1 (Important). "Charge types marked agreed = 76" names a grouping the worksheet does not have

The 107 rows in `DTP PROPOSED NEW CHARGES AGREED (76 new)` do not collapse to
76 charge types under any derivation I could run against the tab:

```
107 rows
105 distinct texts with the statute citation stripped
101 distinct first-comma segments
 68 distinct statute citations
```

What is exactly 76 is the reviewer's response column: **76 of the 107 rows
carry a response, and every one of them starts with "Y"** (38 bare `Y`, the
rest `Y with framework to arraign depending on freq`, `Y with similar
framework to Larceny or B&E`, `Y if attempt to commit something on list of
15`, and so on). The 31 rows with no response are almost all the civil motor
vehicle rows carrying the tab's `*` marker (32 starred rows, only 2 of them
answered).

So the number's checkable referent is rows the reviewer marked, not charge
types. The relabel traded a collision with "charges" for a claim about
grouping that the source contradicts.

**Fix.** `{ label: 'Descriptions marked agreed', value: '76' }`. Beside
"Statute-variant strings = 107" it then reads as 76 of the 107 descriptions
carrying an agreement, which is exactly what the tab shows. It also upgrades
the number's provenance from "the section header says (76 new)" to a count
anyone can reproduce from the rows.

### NB2 (Important). "Distinct strings = 16" is false; the qualifier that made it true was dropped

The disagreed section's 17 rows are 17 distinct strings. The ground truth's own
overlap check says so: "no duplicate strings within any single section". 16 is
what survives after the current-list precedence removes `METHAMPHETAMINE,
POSSESS TO DISTRIB c94C §32A(c)`, which also sits on the operative list.

Paired as "Review rows = 17" and "Distinct strings = 16", the chips now assert
that 17 rows contain 16 distinct strings, which is the one reading the source
rules out. The old label, "Strings after precedence", carried the qualifier.

**Fix.** `{ label: 'Strings left after precedence', value: '16' }`, or
`{ label: 'Strings this tier can label', value: '16' }`. "Review rows = 17"
is fine as it stands.

### NB3 (Minor). The new conflict tooltip uses "YY tab", a term the Browse tab never defines

`title` and `aria-label` are now "On the YY tab and in the review's disagreed
section." True of all 10 rows, and the improvement over the old text is real.
But on that tab the Class column reads "On the decline list", the provenance
line never mentions YY, and the only place the letters are defined is the XLSX
About sheet, a separate download. The old tooltip bridged both ("tagged on the
decline list (YY)").

**Fix.** "On the decline list (the worksheet's YY tab) and in the review's
disagreed section."

### NB4 (Minor). "Counts cover the full datasets" is not what the columns count

The added sentence reads "Counts cover the full datasets and ignore any active
filters." Both columns count `filed_in_window` rows only: the 2006-2021 column
covers 874,107 of the pre-2022 file's 1,092,889 rows, leaving out 218,782. The
column headers carry the window and the XLSX says it correctly ("Each column
counts every charge filed in that window across the whole file"), so no number
on screen is wrong, and the sentence's real job, the filter disclosure, lands.

**Fix.** "Counts cover every charge filed in each window across both datasets,
whatever the view is filtered to."

### NB5 (Minor). One set, three names, after M2 fixed only one of the two sentences

The YY card now says "descriptions the review tab put in its disagreed
section". `DTP_CAVEAT`, rendered directly below that card, still says
"descriptions the review tab rejected". The Browse tab's chip says "Rejected"
(I6, deferred). Before the wave the modal was consistently wrong; it is now
inconsistent, and a reader has to work out that all three name one set of 10
descriptions. The fixer flagged this himself and left it because no finding
covered the caveat sentence.

**Fix.** Carry M2's wording into the caveat: "some charges tagged as on the
decline list carry descriptions the review tab put in its disagreed section."

## Carry-over, not new

The fixer's own observation is correct and worth a ruling: the
`Proposed, rejected` card's paragraph 2 ends "That is the documented
inconsistency noted above," and the caveat it points at renders *below* the
cards in `renderSection()`. Same direction error I5 fixed, in the sentence next
door, pre-existing since `daf9419` and missed by my first pass. One-line fix:
"noted in the caveat below."

## Bottom line

Both Criticals are genuinely fixed and reproduce: the file-scoped shares are
true under their labels, the XLSX carries the 69-versus-46 correction with the
numbers interpolated from gated values, and re-running the script reproduces
the committed JSON byte for byte with 16 of 16 gates passing. The two
deferrals are defensible. What the wave shows is that relabeling is not a safe
edit: two chips traded a wrong noun for a wrong claim, and NB2 is the worse of
the pair because it contradicts a fact the ground-truth doc states outright.
NB1 and NB2 are one-line label edits and should ship before this branch merges;
NB3 through NB5 can ride along.

---

# Re-review, round 2

Commit `3566bd4`, "DTP modal: chip labels say what the numbers count". Four
strings changed, one deferral. Every claim below was re-derived against
`SCDAO-DTP-Classification.xlsx` and the parquets.

| # | Verdict | Evidence |
|---|---|---|
| NB1 | **ADDRESSED** | "Descriptions marked agreed = 76". Re-derived against the `YY REVIEW` agreed section: 76 of the 107 rows carry a response, those 76 rows hold **76 distinct descriptions**, and **every response starts with "Y"** (none starts with anything else). The label is now reproducible from the tab, and the number carries two independent supports: the section header's "(76 new)" and the 76 answered rows |
| NB2 | **ADDRESSED** | "Review rows = 17" and "Strings left after precedence = 16". Both true: 17 rows sit under `DTP PROPOSED NEW CHARGES DISAGREE (17)`, and 16 strings survive the `current > agreed > disagreed` precedence. The false implication (17 rows holding 16 distinct strings) is gone, and "precedence" is defined in the card's own paragraph 1 directly below the chips |
| NB3 | **DEFERRED-OK** | The ruling holds up. "YY tab" is defined by `DTP_CAVEAT`'s "The decline-list tags come from the classification's broader YY tab", which renders on the Decline list tab (the modal's default) and on Review status, and is the paragraph carrying the "See the conflicting rows" link. Every deep-link arrival has read the definition, and everyone else meets it on the tab the modal opens to |
| NB4 | **ADDRESSED** | "Counts cover each dataset's filed charges and ignore any active filters." The overstatement is gone: "filed charges" now points at the column headers' windows rather than claiming the whole file. Residual noted below |
| NB5 | **ADDRESSED** | "descriptions the review tab marked disagreed". True of all 10 conflict descriptions at section level, and it matches the YY card's "put in its disagreed section". The modal now names the set one way in both places |

## Fresh falsehoods in the four new strings: none

Each was attacked on its own:

- **"Descriptions marked agreed = 76."** Six of the 76 responses are
  conditional agreements with a stated N branch: four read "Y if attempt to
  commit something on list of 15, N if attempt to commit something excluded
  from list of 15" and two read "Y with similar framework to MDP and WDP, N if
  property includes monuments or gravestones". All six still open with Y and
  all six sit in the section the worksheet titles AGREED, so "marked agreed"
  holds. Observation only, and if a later wave wants the nuance visible the
  card's paragraph is the place for it, not the chip.
- **"Review rows = 17."** Reads as rows in this tier's section, which is what
  it is. The whole review tab holds 170 rows across three sections, so the
  label depends on the card for its scope; the card's paragraph names "the
  section's raw rows" one line below. Acceptable.
- **"Strings left after precedence = 16."** Exactly the fact the ground-truth
  doc records. No new claim.
- **"Counts cover each dataset's filed charges and ignore any active
  filters."** Residual, not a falsehood: every charge in each dataset was filed
  at some point, and the columns count only those filed inside that dataset's
  window (161,134 of 200,630 rows; 874,107 of 1,092,889). The column headers
  "Filed 2022-2025" and "Filed 2006-2021" supply the window, and the Browse tab
  prints no denominator, so no share can be miscomputed from that screen.
  Nothing further needed. If it is ever touched again, "Counts cover every
  charge filed in each dataset's window, whatever the view is filtered to"
  closes it.
- **"descriptions the review tab marked disagreed."** Section-level and true
  for all 17 rows, so it survives the three HTU deferral rows and the PWID row
  that killed "rejected". The Browse tab's "Rejected" chip is now the only
  place the old word survives, and that is the deferred I6 half.

## Checks

- `npm run test`: **84 passed (84)**, 3 files.
- Dash sweep over `src/ui/dtpModel.ts` and `src/ui/DtpBrowseTab.tsx`, the two
  files this commit touched: **no hits** for em dash, en dash, figure dash,
  non-breaking hyphen, horizontal bar, minus sign, small or fullwidth hyphen.
- Rendered caveat re-read end to end for spacing after the concatenation was
  re-split: "... and the tagging here preserves it. The decline-list tags come
  from ..." Single spaces, no doubled period.

Nit for the code pass, not content: the caveat's concatenation now carries an
orphan `'it. The ' +` fragment from the re-split. Output is correct; the
literal just reads oddly in the source.

## Bottom line, round 2

All four fixes land and introduce nothing new. NB1 is the strongest of them:
the chip went from a grouping the worksheet does not have to a count anyone can
reproduce by opening the tab and counting answered rows. NB3's deferral is
sound because the term is defined on the tab the modal opens to, not only on
the deep-link path. Content is clean; the only remaining known items on this
surface are the ruled deferrals (I6's "Rejected" chip, M5's conflict line,
M1's blank-review clause) and the pre-existing "noted above" direction error in
the Rejected card's paragraph 2.
