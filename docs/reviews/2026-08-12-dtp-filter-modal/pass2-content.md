# Pass 2 of 5: adversarial content review of the DTP modal

Target: `DTP_HEADER`, `DTP_CAVEAT` and every card's `plain` + `detail` string in
`src/ui/dtpModel.ts` (branch `dtp-filter-modal`).

Posture: hostile reader. A lawyer for a DA candidate, a DAMION administrator,
and a fact-checker. The question asked of every sentence is not "is the number
right" (Task 6 answered that) but "what does this sentence assert, who does it
assert it about, and does the primary source support it."

**Findings: 3 Critical, 7 Important, 5 Minor.**

## What Task 6 did not check, and why it matters

Task 6 verified six numbers and a date against the workbook and
`hayden.parquet`. Every one of them survives this pass. What it did not check is
the thing that does the damage:

1. **Which workbook tab actually produces `dtp_class`.** Task 6 verified the 46
   against the `YY REVIEW` tab. It never checked that the `dtp_class` column is
   built from a *different tab* with a different, larger set of strings.
2. **The reviewer columns.** The workbook is a review instrument. Task 6 read
   the section headers and never read the responses.
3. **`history.parquet`.** Every data claim was checked against
   `hayden.parquet` only. The explorer has a history toggle.
4. **The memo's own scope limits.** Task 6 confirmed the memo is dated 2019. It
   did not read what the policy says about which courts and which charges it
   covers.
5. **The provenance of the workbook file itself**, which CLAUDE.md makes a
   standing rule (`unzip -p file.xlsx docProps/core.xml`).

Rendering note that governs severity throughout: in `DtpFilterModal.tsx` every
`detail` array renders inside a collapsed `<details>`. **A screenshot shows only
`DTP_HEADER.plain`, each card's `plain` sentence, and `DTP_CAVEAT`.** A
correction that lives in `detail` is not a correction for the purposes of attack
angle 6. Three of the sentences below are the ones a screenshot publishes.

---

## Critical

### C1. The "On the decline list" tag is not the operative decline list, and the difference is drug distribution

**Sentence (visible):** "Charge types on the office's operative
decline-to-prosecute list."
**Detail (collapsed):** "The operative list is 46 charge descriptions..."

`dtp_class` is not built from the 46. `load_dtp()` in
`data/assembled/build_pre2022.py` (line 148) walks tabs `YY`, `NY`, `NS`, `NN`
and maps column A to a label. The `YY` tab holds **69 charge strings**, and 23
of them are not on the `YY REVIEW` tab's "DTP CURRENT CHARGES (46)". All 46
current-list strings are in the YY tab; the YY tab adds 23 more on top.

The card tells the reader the tag means the 46. The tag means the 69.

The 23 extras are not a rounding error in composition. Eight of them are drug
**distribution** charges that the workbook's reviewer annotated, in the
workbook's own words, `NOT IN MEMO AND WOULD NOT ADD`:

| description | Hayden charges | pre-2022 charges |
|---|---|---|
| DRUG, DISTRIBUTE CLASS B c94C §32A(a) | 1,465 | 7,404 |
| DRUG, DISTRIBUTE CLASS A c94C §32(a) | 703 | 4,510 |
| COCAINE, POSSESS TO DISTRIBUTE c94C §32A(c) | 300 | 681 |
| DRUG, DISTRIBUTE CLASS D c94C §32C(a) | 233 | 2,459 |
| COCAINE, DISTRIBUTE c94C §32A(c) | 206 | 588 |
| DRUG, DISTRIBUTE CLASS C c94C §32B(a) | 166 | 825 |
| DRUG, DISTRIBUTE CLASS E c94C §32D(a) | 86 | 628 |
| METHAMPHETAMINE, DISTRIBUTE c94C §32A(c) | 14 | 7 |

Totals for YY-tagged charges whose description is not on the operative 46:
**3,211 of 48,146 Hayden-era charges (6.7%)** and **48,628 of 271,464 pre-2022
charges (17.9%)**.

The memo is against the copy here. Appendix D lists "Drug possession" and "Drug
possession with intent to distribute". It does not list distribution. Appendix C
is "the list of 15 offenses". Distribution is on neither.

So the visible sentence, published as a screenshot next to a live count of
48,146, is a statement that the Suffolk County District Attorney's operative
decline-to-prosecute list includes cocaine distribution. It does not, the memo
does not say it does, and the workbook's own reviewer wrote in the cell that it
should not.

This is the single sentence in the modal most likely to end up on a mailer.

**Minimal fix.** The correction has to be visible, not in `detail`:

```
plain: 'Charge types the classification workbook puts on the 2019 decline
        list. The workbook's list runs wider than the operative 46, and the
        extras are mostly drug distribution charges.'
```

and in `detail`, replace "The operative list is 46 charge descriptions" with
"This tag comes from the workbook's YY tab, 69 charge descriptions. 46 of them
are the operative current list. The other 23 are proposals, including eight drug
distribution charges the workbook's reviewer marked 'not in memo and would not
add.'"

### C2. "The office presumes against prosecuting" covers assault and solicitation, which the office never listed

**Sentence (visible):** "Charge types the office presumes against prosecuting,
short of the formal list."

The workbook's `Intro` tab defines NY in its own words: "'No' the charge is not
cited specifically in the DTP in Appendix C of the The Rollins Memo, and 'Yes'
it is either envisioned in one of the broader categories in the DTP in Appendix
D of The Rollins Memo, **or should be**."

"Or should be" is the workbook author's recommendation. The card converts it
into a stated office position. What that sweeps in:

| description | dtp_class | reviewer note | Hayden | pre-2022 |
|---|---|---|---|---|
| ASSAULT c265 §13A | NY | NOT IN MEMO AND WOULD NOT ADD | 796 | 3,884 |
| SEXUAL CONDUCT FOR FEE c272 §53A | NY | No | 69 | 2,135 |
| PROSTITUTE, SOLICIT FOR c272 §8 | NY | No | 52 | 32 |
| COUNTERFEIT DRUG, POSSESS TO DISTRIBUTE c94C §32G | NY | No | | |

None of these appears in Appendix C or Appendix D. 42 of the NY tab's 108 rows
carry a reviewer note of "No", "NOT IN MEMO AND WOULD NOT ADD", or "HTU needs to
be consulted"; those strings account for 2,021 Hayden-era and 13,548 pre-2022
charges.

"The office presumes against prosecuting assault" is a factual claim about a
sitting District Attorney that the primary sources contradict.

**Minimal fix:**

```
plain: 'Charge types the classification treats as carrying a presumption
        against prosecution, short of the formal list.'
```

and in `detail`, keep the existing sentence but add: "The workbook's own
definition includes charges its author judged *should* fall under the memo's
broader categories, not only charges the memo names."

### C3. "The office weighs one case at a time" describes a designation its own reviewer rejected for three quarters of the volume

**Sentence (visible):** "Charge types the office weighs one case at a time."

Two problems, and the second is the serious one.

First, the workbook defines NS as "'Sometimes' the charge **should be**
considered for diversion or declination". Recommendation, not practice.

Second: the `YY REVIEW` tab's instruction, repeated at the top of every tab,
reads "To save time, you can also just put an (N) for disagree and leave the ones
you agree with blank." On the NS tab the reviewer entered a bare **`N` on 405 of
628 rows**. Those 405 strings carry **43,356 of 57,079 Hayden-era NS charges
(76.0%)** and **270,086 of 380,079 pre-2022 NS charges (71.1%)**.

The modal presents as office practice a designation that the workbook's only
reviewer rejected for roughly three quarters of the charge volume it covers. The
`dtp_review` column cannot rescue this: it is built only from the `YY REVIEW`
tab, so the NY/NS/NN tabs' disagreements appear nowhere in the data and nowhere
in the modal. `DTP_CAVEAT` does not cover them either.

Across all four tabs, descriptions carrying a reviewer disagreement account for
**48,556 of 200,630 Hayden-era charges (24.2%)** and **302,911 of 1,092,889
pre-2022 charges (27.7%)**.

**Minimal fix:**

```
plain: 'Charge types the classification marks for case-by-case consideration.'
```

and add one visible line to `DTP_HEADER.plain` or `DTP_CAVEAT`: "The workbook's
reviewer disagreed with the category assigned to about a quarter of these
charges. Those disagreements are recorded in the workbook, not in this data."

---

## Important

### I1. "A working group agreed" is not what the review tab records

**Sentence (visible):** "A working group agreed to expand the list by 76
charges; the expansion was never adopted as policy."

The `YY REVIEW` tab has four reviewer columns, headed **RR, DSP, LR, MT**, under
the instruction "Please use the alphebatized columns with your initials to the
right to indicate whether you agree (Y) or disagree (N) with the designation for
each charge."

Filled cells by column: **RR 0, DSP 139, LR 0, MT 0.**

One person responded. The tab documents a list circulated to four reviewers with
a single set of answers, not a working group's collective agreement. "A working
group agreed" and "the working group said no" both assert a collective act the
primary source does not record. A DAMION administrator or anyone with the
workbook refutes this in thirty seconds.

"Never adopted as policy" has no source anywhere in the repo. `notes.md` asserts
it; no document supports it. It is a negative claim about the office's conduct
and needs either a source or a retreat to what the workbook shows.

**Minimal fix:**

```
plain: 'The workbook's review tab groups 76 further charges as proposed and
        agreed. Nothing in the workbook records the office adopting them.'
```

and in `DTP_HEADER.detail`, replace "records what a working group proposed to
add to the list and what was agreed or rejected" with "records a proposed
expansion circulated to four reviewers, sorted into agreed and disagreed
sections. One reviewer's responses are filled in."

### I2. "The working group said no" is wrong for four of the seventeen rows

**Sentence (visible):** "Proposed for the expansion; the working group said no."

Three of the 17 rows in the "DTP PROPOSED NEW CHARGES DISAGREE (17)" section
read `HTU needs to be consulted`: NIGHTWALKER, COMMON c272 §53; NIGHTWALKER,
COMMON, 3RD OFFENSE c272 §53; STREETWALKER, COMMON c272 §53. That is deferral to
the Human Trafficking Unit, not rejection. A fourth, DRUG, DISTRIBUTE OR POSSESS
WITH INTENT CLASS D c. 94C s. 32C(a), reads "PWID in memo and agree, Distribution
not in memo and would not add at this time", which is a split answer.

Given the subject matter, a reader who checks will find the project reported
"said no" on three prostitution-related charges where the workbook actually says
a specialist unit needed to weigh in. That is the kind of error that costs the
whole modal its credibility.

**Minimal fix:** `plain: 'Proposed for the expansion, and marked disagree or
unresolved in the review.'`

### I3. "About 1% of charges" is a Hayden-only number in a modal that runs over both datasets

**Sentence (visible):** "Charge descriptions that match nothing in the
classification, about 1% of charges."

`ViewState.history` (`src/contract.ts` line 101) toggles the 2006-2021 dataset
in, and `FilterPanel` renders the DTP entry regardless of lens. Recomputed:

| file | Not listed | total | share |
|---|---|---|---|
| hayden.parquet | 2,124 | 200,630 | 1.06% |
| history.parquet | 63,555 | 1,092,889 | **5.82%** |
| both | 65,679 | 1,293,519 | **5.08%** |

With history on, the card understates by a factor of five, while the live count
rendered next to it shows the true number. The card contradicts its own count.
Task 6 checked `hayden.parquet` only.

**Minimal fix:** `plain: 'Charge descriptions that match nothing in the
classification. About 1% of 2022-2025 charges, about 6% before 2022.'`

### I4. The header understates the workbook's provenance while the cards overstate it

**Sentence (collapsed):** "The categories come from a classification workbook
built with this project's collaborators."

Per CLAUDE.md's standing rule, `unzip -p ... docProps/core.xml`:

```
dc:creator        Constantino, Bobby (SUF)
lastModifiedBy    Bobby Constantino
created           2020-08-11T17:28:40Z
modified          2020-11-24T14:33:49Z
```

The `(SUF)` suffix is the SCDAO account convention on this delivery: two sibling
files in the same `reference/` folder read `Riley, Sharon (SUF)`, and Nasser's
own file in that folder reads `Nasser Eledroos`. The workbook is a 2020
SCDAO-internal document, authored on an office account during the Rollins
administration and circulated inside the office for review, five years before
this project existed.

The copy currently runs both framings at once: the header calls it a workbook
"built with this project's collaborators", and the cards call its contents "the
office's operative list". A hostile reader picks whichever framing hurts more,
and the project has already conceded the other. The accurate description is also
the stronger one, and it is what the file says.

**Minimal fix:** "The categories come from a 2020 SCDAO classification workbook,
authored inside the office and circulated to four reviewers, and applied to each
charge by its charge description (whitespace-normalized, with a 75-character
fallback for descriptions truncated in the source deliveries)."

### I5. Present tense over Hayden-era data, from a workbook last touched in November 2020

Four cards say "the office" in the bare present: "the office's operative
decline-to-prosecute list", "the office presumes against prosecuting", "the
office weighs one case at a time", "the office ordinarily prosecutes".

The data window is 2022-2025, which is the Hayden administration. The workbook
was last modified 2020-11-24, under Rollins. Nothing in the repo establishes
that the Hayden administration operates the Rollins list, or any list. The
header correctly dates the list to 2019 and attributes it to the Rollins
administration, and then the cards drop the attribution and shift to a bare
present-tense "the office", which a reader takes as the current office.

Three weeks before a primary, that reads as a claim about the incumbent's
current charging policy, sourced to a document from his predecessor.

**Minimal fix:** attribute every card to the classification rather than to "the
office", as in C1/C2/C3 above. The header already carries the 2019 and Rollins
attribution, so nothing is lost.

### I6. The memo's own scope limits are omitted, and the tag is applied outside them

Appendix C, page C-1, first line: "At this time, this policy relates only to
charges that will remain in a Division of the Boston Municipal Court, and Chelsea
District Court." Second line: "This list does not limit an ADA's ability to
decline or divert other charges that are not on this defined list of offenses."

The tag is applied to every charge in every court. **879 Hayden-era Suffolk
Superior Court charges carry the YY tag**, in a forum the policy text excludes
by its own terms. And the second sentence means that absence from the list never
implied prosecution, which is the assumption the NN card's "ordinarily
prosecutes" quietly relies on.

**Minimal fix:** one clause in `DTP_HEADER.detail`: "The 2019 policy applied to
charges remaining in a Boston Municipal Court division or Chelsea District
Court, and it did not limit an ADA's discretion over charges not on the list."

### I7. The agreed-expansion card omits the qualification notes.md says any use of it must carry

`notes.md`, in the same session that created this column: "**32 of the 107
agreed-tier strings are asterisked civil motor vehicle infractions** (speeding,
unregistered vehicle), about 30% of the tier's filed charges (8,622 of 28,482 in
2022-2025). ... any essay use of the 40.4% counterfactual has to carry 'nearly
one-third of the agreed expansion is civil traffic infractions' honestly."

The card is exactly such a use and does not carry it. Reading the tab confirms
the shape: SPEEDING * c90 §17, UNREGISTERED MOTOR VEHICLE * c90 §9, TIRE TREAD
DEPTH VIOLATION * c90 §7Q, SAFETY GLASS VIOLATION * c90 §9A and so on, none of
which carry a reviewer response at all.

"A working group agreed to expand the decline list by 76 charges" invites the
reader to picture criminal charges. Roughly a third of the volume is civil motor
vehicle infractions.

**Minimal fix:** add to `detail`: "About a third of the charges this tier covers
are civil motor vehicle infractions, mostly speeding and registration."

---

## Minor

### M1. "The inconsistency is in the source classification" is not fair

**Sentence (visible, in `DTP_CAVEAT`).**

The workbook is coherent on its own terms. The `YY` tab is the superset put up
for review; the `YY REVIEW` tab sorts that superset into the operative 46, the
proposed expansion, and the disagreed set. Both tabs are doing their jobs.

The inconsistency appears because `load_dtp()` collapses the whole `YY` tab into
a single "decline list" label while `load_review()` reads the sections. That is
this project's pipeline, not a defect in the source. Blaming the source for it
is the kind of thing a DAMION administrator would enjoy correcting in public.

**Minimal fix:** "The two groupings are built from different tabs of the same
workbook: the category from the tab that lists current and proposed charges
together, the review tier from the tab that separates them. A ruling on which
should win is pending."

### M2. The memo calls it "the list of 15 offenses", and the 46 is a mapping, not the policy

**Sentence (collapsed):** "The operative list is 46 charge descriptions,
operationalized from the 2019 policy memo's offense categories."

Appendix C, page C-1: "The list of 15 offenses identified for declination and
diversion are included in the chart beginning on page C-3". The memo's own noun
is "the list of 15 offenses", not "offense categories". More to the point, "the
operative list **is** 46 charge descriptions" presents the workbook author's
DAMION string mapping as the policy itself. The policy is 15 offenses; the 46 is
one person's rendering of them into DAMION description strings.

No conflation of 15 with 46 survives into a stated number anywhere, so this is
imprecision rather than error.

**Minimal fix:** "The memo's list of 15 offenses, mapped in the workbook to 46
DAMION charge descriptions."

### M3. Three dash violations against CLAUDE.md's absolute rule

CLAUDE.md: "No em dashes or en dashes. Ever."

- line 54: `'Caveat: 2,393 charges filed 2022–2025'` (en dash)
- line 119: `'tag in the other grouping — that is the documented '` (em dash)
- line 126: `'Everything the review never looked at — the large majority of charges.'` (em dash)

Fixes: `2022-2025`; "grouping. That is the documented"; "at. It is the large
majority of charges."

### M4. "Where its charge type stands relative to that list" is not what three of the four categories measure

**Sentence (visible, in `DTP_HEADER.plain`).**

NY, NS and NN are defined partly by the workbook author's judgment ("or should
be", "should be considered", "should not be considered"), not purely by position
relative to the memo's list. The framing promises a positional measurement and
delivers a partly normative one. Largely repaired by the C2/C3 fixes; noted so
the header is not left as the last place the old framing survives.

### M5. The YY caveat's 2,393 is a filed-window figure sitting next to an all-rows count

The card's live count shows all rows (48,146 in the Hayden file). The caveat in
its `detail` says 2,393, which is `filed_in_window` only. The all-rows figure is
3,176. Both are correct for their scope and the scope is stated, but the two
numbers sit inches apart and invite a reader to think they describe the same
set. Consider giving the all-rows figure, or matching the card's scope.

---

## Sentences I could not refute

One line each, as asked.

- "In 2019 the Rollins administration published a list of charges the office
  would presume not to prosecute." Confirmed: cover reads MARCH 2019, the DA's
  letter is dated March 25, 2019, and Appendix C reads "The presumption is that
  charges that fall into this category should always be declined."
- "They describe the charge type, not what happened to the individual case."
  Correct, and the most valuable sentence in the modal.
- "In this data the tag is applied by charge description, so it reflects the
  charge as recorded, not a case-level decision." Correct, matches `dtp_of()`.
- "(whitespace-normalized, with a 75-character fallback for descriptions
  truncated in the source deliveries)" Correct, matches `norm_ws` and the
  `[:75]` fallback in both `dtp_of()` and `review_of()`.
- "The agreed expansion covers 107 statute-variant description strings."
  Re-derived independently: 107.
- "16 description strings" for the disagreed tier. Re-derived: 17 rows in the
  section, 16 reachable after `current > agreed > disagreed` precedence. Task
  6's fix was right.
- "Where one description also appears in a rejected proposal, the operative list
  wins." Correct description of `load_review()`'s precedence.
- "2,393 charges filed 2022-2025 carry this tag on descriptions the review tab
  lists as proposed-but-disagreed." Re-derived: 2,393.
- "76" as a quantity attributed to the workbook. The section header does read
  "DTP PROPOSED NEW CHARGES AGREED (76 new)". The number is the workbook's. Only
  the attribution of the *act* to a working group fails (I1).
- "Mostly truncated or rare description variants that failed the match even with
  the 75-character fallback." Consistent with the `c. 266 s. 120` style variants
  observed; nothing contradicts it.
- "No proposal touched these charge types; absence from review is not a
  statement about them." Correct, and the right disclaimer.
- "Classified NN in the workbook." Accurate, and the NN tab is the one tab where
  the reviewer agreed with every row (498 of 498 read "Agree should not be in
  Declination Policy").

## Bottom line

The numbers hold. The attributions do not. Six visible sentences tell the public
that the current Suffolk County DA's office declines, presumes against, or
weighs charge types, when the source is a 2020 internal workbook from the
previous administration whose only reviewer disagreed with the category on about
a quarter of the charge volume, and whose "decline list" tag, as this project
builds it, includes 3,176 Hayden-era drug distribution charges that the memo
never listed and the reviewer expressly refused. Fixing this is a voice change,
not a data change: attribute every card to the classification instead of to "the
office", move the YY tab caveat out of the collapsed `<details>`, and correct
"working group" to what the tab actually records.

---

# Re-review (pass 2 of 5, after the Task 7 fix wave)

Judged against `1166220` (the content rewrite), the fixer's report, and the
current `src/ui/dtpModel.ts`. `aefb48e` (rebuilt parquets) was skimmed only; it
belongs to pass 5. Every number the rewrite introduced was re-derived here from
the worksheet and both parquets rather than read off the fixer's table.

## Verdicts

| # | Finding | Verdict |
|---|---|---|
| C1 | Decline-list tag is the 69-string YY tab, not the operative 46 | **ADDRESSED** |
| C2 | "The office presumes against prosecuting" covers unlisted charges | **ADDRESSED** |
| C3 | NS designation its own reviewer rejected | **ADDRESSED** |
| I1 | "A working group agreed" / "never adopted as policy" | **NOT ADDRESSED** (attribution half fixed, unsourced negative remains) |
| I2 | "The working group said no" wrong for four of seventeen rows | **ADDRESSED** |
| I3 | "About 1% of charges" is Hayden-only | **ADDRESSED** |
| I4 | Worksheet provenance | **ADDRESSED** |
| I5 | Present-tense "the office" across four cards | **ADDRESSED** |
| I6 | Memo's court-scope limit | **ADDRESSED** |
| I7 | Agreed tier's civil motor vehicle infractions | **ADDRESSED** |
| M1 | "The inconsistency is in the source classification" | **ADDRESSED** |
| M2 | Memo calls it "the list of 15 offenses" | **ADDRESSED** |
| M3 | Dash violations | **ADDRESSED** |
| M4 | Positional framing in the header | **ADDRESSED** |
| M5 | 2,393 filed-window figure beside an all-rows count | **DEFERRED-WITH-RULING**, rationale holds |

**14 addressed, 1 not addressed, 1 deferred. 1 new breakage.**

## Verification of the new numbers

Re-derived independently in this session, not carried from the fixer's table:

| claim in shipped copy | my value | verdict |
|---|---|---|
| YY tab = 69 charge-description strings | 69 distinct | confirmed |
| the 46 is narrower than the YY tab | 46 is a strict subset, 23 extras | confirmed |
| YY tab includes distribution charges annotated as not in the memo | 11 extras annotated `WOULD NOT ADD`, all distribution-family | confirmed |
| NS disagreement covers about three quarters | 76.0% hayden / 71.1% history | confirmed |
| Not listed about 1% / about 6% | 1.06% / 5.82% | confirmed |
| 32 of 107 agreed rows are civil MV infractions | 32 of 107 | confirmed |
| about a third of the agreed tier's 2022-2025 volume | 30.0% all rows | confirmed |
| memo lists 15 offenses | verbatim Appendix C page C-1 | confirmed |
| 16 strings after precedence over 17 raw rows | 16 / 17 | confirmed |
| three HTU deferrals and one split row | 3 and 1 | confirmed |
| Suffolk Superior carries the tag by charge type only | 879 YY-tagged | confirmed |

Dash sweep over the full Unicode dash range
(`‐ ‑ ‒ – — ― − ﹘ ﹣ －`) against `src/ui/dtpModel.ts` and
`src/ui/DtpFilterModal.tsx`: **zero hits.** M3 holds.

**Correction to my own pass-2 record.** I wrote "eight" drug distribution
strings among the 23 extras. The annotation-based count is **11** (three cocaine
and oxycodone rows, drug classes A through E, the PWID split row, and
methamphetamine distribute plus methamphetamine possess-to-distribute 2nd). The
fixer's 10-plus-1 is the same set counted the same way. No shipped copy asserts
a number here, so nothing in the UI moves. My C1 volume figures (3,211 Hayden
off-list charges, 48,628 pre-2022) are unaffected and still reproduce.

## I1: NOT ADDRESSED, and why the card must match the header

The attribution half is fixed and fixed well. "A working group agreed" is gone;
the visible sentence now reads "A 2020 review inside the office marked 76
further charges agreed for declination", which is checkable against the section
header "DTP PROPOSED NEW CHARGES AGREED (76 new)" and the worksheet's 2020
provenance. The header's detail paragraph now states the four columns, the one
respondent, and "The worksheet records no adoption of the expansion." That
paragraph is the correct sentence.

What remains is the second clause of the card's visible sentence: **"the
expansion never became policy."** No document in the repo records the office
declining to adopt the expansion. What exists is the absence of a record of
adoption, which is a different fact. The fixer flagged this itself as its
weakest sentence and kept it on ruling R4.

The structural problem is worse than the wording. `DtpFilterModal.tsx` renders
every `detail` inside a collapsed `<details>` and every `plain` in the open. So
the rewrite has put the **checkable** form of this claim in the collapsed
paragraph and left the **unsourceable** form in the sentence a screenshot
publishes. That is the exact inversion of what ruling R8 did for C1, where the
correction was deliberately promoted into the always-visible caveat strip. The
same logic applies here and points the other way.

Yes, the card should match the header. Exact replacement for the card's `plain`:

```
plain: 'A 2020 review inside the office marked 76 further charges agreed for
        declination. The worksheet records no adoption of the expansion.'
```

Two sentences instead of a semicolon, no dashes, no hedge, and the modal stops
making the same claim at two different strengths. It also stays above the
20-character content-test floor.

**One constraint the fix wave did not name.** The phrase is also baked into the
data: the filter value is `'Proposed, agreed (never adopted)'` and the card
`name` is `'Proposed and agreed, never adopted'`. Changing those means a parquet
rebuild, which is out of scope for a copy wave. Fixing the sentence still
removes the assertion, and leaves "never adopted" only as a category label. The
label should be raised with the plan owner separately.

## NEW BREAKAGE

### NB1 (Minor). The Not-listed card's causal explanation overstates one cause, and its verification was selective

New sentence, Not listed card detail:

> "The pre-2022 share runs higher because the older deliveries record many
> charges in a plainer description format, such as "TRESPASSING" where the
> worksheet carries "TRESPASS c. 266 s. 120"."

The example is real. `TRESPASSING` is unmatched at 1,606 charges and the
worksheet does carry `TRESPASS c. 266 s. 120`, with no bare `TRESPASSING` string
on any tab. The word "because" is what fails.

Ground truth row 13 says the top unmatched pre-2022 descriptions "are exactly
this shape: `TRESPASSING` (1,606), `OPERATING UNREGISTERED MOTOR VEHICLE`
(1,315), `POSSESSION OF CLASS B, DRUGS` (1,267)." Ranked by volume, the actual
top unmatched descriptions in `history.parquet` are:

| charges | description |
|---:|---|
| 3,506 | DESTRUCTION OF PROPERTY +$250, MALICIOUS c. 266 s. 127 |
| 2,070 | MOTOR VEH, LARCENY OF/MALICIOUS DAMAGE/RECEIVE STOLEN/TAKE AND STEAL PARTS c. 266 s. 28(a) |
| 1,808 | A&B WITH DANGEROUS WEAPON +60 c. 265 s. 15A(a) |
| 1,736 | OPERATING AFTER REVOCATION OR SUSPENSION |
| 1,606 | TRESPASSING |
| 1,598 | SHOPLIFTING; OVER $100.00 c. 266 s. 30A |
| 1,583 | UTTER FALSE CHECK, INSTRUMENT, OR PROMISSORY NOTE c. 267 s. 5 |
| 1,315 | OPERATING UNREGISTERED MOTOR VEHICLE |

`TRESPASSING` is fifth, not first. Five of the top eight are fully statute-cited
descriptions, which is the opposite of "a plainer description format". They are
charge types the worksheet never covered at all, including the over-$250
destruction of property variant where the worksheet carries only the under-$250
ones. The three rows quoted in row 13 total 4,188 of 63,555 unmatched charges,
about 7%. The stated cause cannot carry the word "because".

This is minor in consequence: it sits in a collapsed detail, it is explanatory
rather than load-bearing, and no filter or number depends on it. It is flagged
because it is a new causal claim that was marked PASS on a ranking that does not
survive a re-run.

**Minimal fix**, repo voice, no dashes:

```
'The pre-2022 file carries 1,079 distinct unmatched descriptions. Some are
 plainer spellings the worksheet does not carry, such as "TRESPASSING" where
 the worksheet carries "TRESPASS c. 266 s. 120". Others are charge types the
 worksheet never covered, such as destruction of property over $250.'
```

Both halves are checkable: 1,079 distinct unmatched descriptions reproduces, and
`DESTRUCTION OF PROPERTY +$250, MALICIOUS c. 266 s. 127` is the largest
unmatched string at 3,506 charges.

## Notes that are not findings

- **"About three quarters" is unscoped while the civil-infraction share is
  scoped.** NS holds at 76.0% and 71.1%, so the claim survives the history
  toggle, but 71% is a four-point stretch for "three quarters". The fixer raised
  this as its concern 2 and I agree with its framing: it is a consistency ruling
  for the plan owner, not an error.
- **"The municipal courts"** paraphrases the memo's "a Division of the Boston
  Municipal Court". Accurate for the eight BMC divisions in the data, and the
  following clause names Suffolk Superior correctly. Acceptable.
- **"It is the large majority of charges"** (Not reviewed) is 59.8% in the
  Hayden file and 64.0% pre-2022. The rewrite changed only the punctuation here,
  so I am not reopening it, but "large majority" for 60% is loose if the
  sentence is ever touched again.
- **`data/assembled/README.md` still reads `'Proposed, disagreed' (17)`** while
  the UI now says 16 and shows the arithmetic. Third wave in a row this has been
  deferred on file-scope grounds. It should be fixed before the data
  documentation and the UI drift apart in public.

## Bottom line

The rewrite is a real fix: all three Criticals are closed at the visible layer,
every number it introduced reproduces independently, and the copy no longer puts
words in the current District Attorney's mouth. One sentence still asserts what
no document shows, and it is the one a screenshot publishes.

---

# Re-review round 3 (after `abf99b5`)

Two items. Both **ADDRESSED**. No new breakage.

## I1: ADDRESSED

The card's visible sentence now reads, verbatim as proposed:

> "A 2020 review inside the office marked 76 further charges agreed for
> declination. The worksheet records no adoption of the expansion."

The unsourced negative is gone. The card and the header now make the same claim
at the same strength, and that claim is checkable against the worksheet: the
section header reads "DTP PROPOSED NEW CHARGES AGREED (76 new)", the file was
created and last modified in 2020 on an SCDAO account, and nothing in the
workbook records an adoption.

The fixer also cut the detail's trailing clause "not anything the office
committed to". That was the right call and I would have flagged it had it
stayed: it is an unsourced negative of exactly the same family as the sentence
it now sits under, and the visible sentence already carries the point in
checkable form. The detail's closing sentence is now "Filtering on this shows
what the expansion would have covered."

The residual noted in round 2 stands unchanged and is not a copy defect: the
strings `'Proposed, agreed (never adopted)'` (filter value) and "Proposed and
agreed, never adopted" (card name) still contain the phrase, and moving them
requires a parquet rebuild. It is a label, not an assertion. Still worth a plan
owner ruling.

## NB1: ADDRESSED, and my example was the thing that was wrong

**The fixer is right and I was wrong.** I verified its derivation independently
and it reproduces exactly.

The worksheet does carry the charge I claimed it never covered:

```
worksheet, NS tab : DESTRUCTION OF PROPERTY +$250, MALICIOUS C266 §127    (len 50)
pre-2022 file     : DESTRUCTION OF PROPERTY +$250, MALICIOUS c. 266 s. 127 (len 54)
```

Both strings are under 75 characters, so `dtp_of()`'s prefix fallback never
engages, and their 75-character prefixes differ anyway. The match fails on
statute-citation style alone. My error was inferring "the worksheet never
covered this charge type" from `dtp_class = 'Not listed'`, which only ever means
the string did not match. That is inference from absence, which is the same move
I flagged in I1. It was wrong here and the fix wave was right to reject it.

My verification of the recovery figure, using a canonical citation form
(`§` to `S`, periods stripped, spaces closed between `C`/`S` and their digits),
re-running the worksheet lookup over every unmatched description in
`history.parquet`:

```
Not listed, history.parquet : 63,555 charges / 1,080 description groups
  of which null or blank    :    447 charges /     1 group
  non-blank unmatched       : 63,108 charges / 1,079 distinct descriptions
recovered by citation canon : 16,022 charges across 158 distinct strings
  share of 63,108           : 25.4%
```

**16,022 of 63,108, 25.4%, 158 strings.** Every figure matches the fixer's to
the unit, and the 63,108 denominator is exactly 63,555 minus the 447 blank
descriptions, which is the right denominator for a claim about description
strings. The largest recovered strings are `DESTRUCTION OF PROPERTY +$250,
MALICIOUS` (3,506), `A&B WITH DANGEROUS WEAPON +60` (1,808), `DISTURBING THE
PEACE` (1,132), `REGISTRATION SUSPENDED, OP MV WITH` (747).

The shipped sentence is accurate on both halves:

> "The pre-2022 file carries 1,079 distinct unmatched descriptions. Some are
> plainer spellings the worksheet does not carry, such as "TRESPASSING" where
> the worksheet carries "TRESPASS c. 266 s. 120". Others are charge types the
> worksheet does carry, written with a different statute citation, such as the
> destruction of property charge this file cites as "c. 266 s. 127" against the
> worksheet's "c266 §127"."

- 1,079 distinct unmatched descriptions: confirmed.
- `TRESPASSING` is a genuine gap: confirmed, no bare `TRESPASSING` on any of the
  four tabs, and the citation canon does not bridge it either.
- The destruction of property example: confirmed as a citation-style mismatch,
  not a coverage gap.
- The causal "because" that made the original sentence fail is gone. The
  sentence now enumerates two observed causes without claiming either explains
  the whole gap, which is what the evidence supports.

Ground-truth row 13 was rewritten to match, marked REVISED, and carries the
correction note. Dash sweep over `src/ui/dtpModel.ts`: zero hits.

## One note, not a finding

The Not-listed card's first paragraph still says the unmatched are "mostly
truncated or rare description variants". That clause is pre-existing, the
rewrite did not touch its wording, and I passed it in both earlier rounds, so I
am not reopening it. But the new second paragraph now sits in mild tension with
it: at least 25.4% of the pre-2022 unmatched charges are neither truncated nor
rare, they are ordinary high-volume charges written in a different citation
style, and `TRESPASSING` at 1,606 is not rare either. If that paragraph is ever
edited for another reason, "mostly truncated or rare" is the phrase to revisit.

## Round 3 bottom line

Both items close. The one substantive disagreement in this round was mine to
lose: the fixer caught a false example in my proposed wording, derived the
correction from the primary sources, and the shipped sentence is more accurate
than what I asked for.
