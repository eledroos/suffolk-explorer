# Fix wave: pass-content (C1-C2, I1-I9, M1-M5) plus the regression lockfile minor

Branch `dtp-modal-v2`, from `592ecec`. Two commits:

- `aa5b3fc` DTP lists: About sheet and provenance carry the modal's corrections
- `74b87e9` DTP modal: chip labels restore the nouns that scoped them

No attribution trailers on either.

## Tally

| # | Ruling | Status | What shipped |
|---|---|---|---|
| C1 | R1 | applied | Not listed chips are file-scoped again: "Share of the 2022-2025 file" = about 1%, "Share of the pre-2022 file" = about 6%. No new derivation; these are the scopes Task 7 row 12 verified (2,124/200,630 and 63,555/1,092,889, all rows in each file) |
| C2 | R2 | applied | `scripts/prepare_dtp_lists.py` rewritten and both assets regenerated (see below) |
| I1 | R3 | applied | "Charge types marked agreed" = 76 |
| I2 | R4 | applied | "Worksheet YY strings" = 69 |
| I3 | R5 | applied | "Operative list strings" = 46 on both the YY card and the Current list card |
| I4 | R6 | applied | "Review rows" = 17, "Distinct strings" = 16 |
| I5 | R7 | applied | `DTP_CAVEAT` drops "above". Reads whole on both tabs: "These two groupings overlap imperfectly: some charges tagged as on the decline list carry descriptions the review tab rejected. The worksheet itself contains the conflict, and the tagging here preserves it. The decline-list tags come from the classification's broader YY tab; the operative 46-string list is the narrower set under Review status." |
| I6 | R8 | applied | Conflict flag `title` and `aria-label` are now "On the YY tab and in the review's disagreed section." The `Rejected` review chip is unchanged, per the ruling |
| I7 | R2 | applied | `source_note` is the ruling's text verbatim; it names the table and the download button, which the reader can see |
| I8 | R2 + R9 | applied | XLSX: new About section naming the two files behind the count columns. UI: the provenance line gains exactly one sentence, "Counts cover the full datasets and ignore any active filters." |
| I9 | R2 | applied | The Conflicts paragraph gives the recipe ("rows where Class is 'YY (decline list)' and Review tier is 'Proposed, disagreed'") and keeps 10 descriptions / 2,393 charges |
| M1 | R11 | **split** | About-sheet half applied (one line defining the Review tier's three values and the blank). Browse half **deferred**: R9 fixes that line's addition at one sentence, and the blank-review clause would be a second |
| M2 | R11 | applied | YY card paragraph 3: "descriptions the review tab put in its disagreed section", true of the section for all 17 rows |
| M3 | R11 | applied | "the tagging here preserves it" |
| M4 | R11 | applied | `PROVENANCE_FALLBACK` mirrors the JSON's `source_note`, so loading and error states carry the same disclosure as the ready state |
| M5 | R11 | **deferred** | An explanatory line above the table when the Conflicts chip is active needs new markup plus a style rule, past this wave's one-liner scope. The flag's meaning is carried by its title and accessible name (I6) and by the caveat sentence that deep-links here |
| regression Minor | R10 | applied | `package-lock.json` restored from `git show 3727e67:package-lock.json`. `git diff 3727e67 -- package-lock.json` is empty; md5 matches |

**14 applied, 1 split (About half applied, Browse half deferred), 1 deferred.**

## Commit 1, `aa5b3fc`: script and regenerated assets

`scripts/prepare_dtp_lists.py`, `public/data/dtp-lists.json`,
`public/downloads/suffolk-dtp-lists.xlsx`, `docs/specs/dtp-ground-truth-results.md`.

About sheet now carries, in order: a title and paragraph 1 that call it a
worksheet made inside the office rather than the office's classification; the
existing provenance and matching-method paragraphs; the new Review tier
definition (M1); the derived-and-not-distributed line; a bolded section, "The
decline list (YY) sheet is broader than the operative list", carrying 69 versus
46, the drug-distribution annotation and the no-adoption statement; a bolded
section, "Where the two count columns come from", naming the 2022-2025 file and
the pre-2022 file and stating the counts ignore the explorer's filters; and the
Conflicts section with the row-finding recipe.

The 69 and the 46 are interpolated from the gated values
(`per_tab_added['YY']`, `review_tally['Current list']`), not typed as literals,
so the gates that already assert them also protect the About text.

Verified after regeneration:

- JSON rows compare equal, row by row, to `HEAD~1`'s file. Only `source_note`
  changed.
- The recipe works on the shipped workbook: `All lists` rows with Class
  `YY (decline list)` and Review tier `Proposed, disagreed` number **10**, their
  `Charges filed 2022-2025` sum to **2,393**, and they are the same 10
  descriptions the JSON marks `"conflict": true`.
- Sheet names, headers, bold header row, `freeze_panes == 'A2'` and row counts
  (1,300 / 69 / 107 / 627 / 497) all match the Task 1 read-back assertions.
- Dash sweep over the new About text, `source_note` and the script: none.

## Commit 2, `74b87e9`: chip labels, caveat, Browse tab, lockfile

`src/ui/dtpModel.ts`, `src/ui/DtpBrowseTab.tsx`, `package-lock.json`,
`docs/specs/dtp-ground-truth-results.md`. No test file needed changing: every
chip value is unchanged, and the digit-duplication test compares values against
prose, not labels. The relabels introduce no new digit into any chip, and no
card's prose gained a number.

Rendered provenance line, ready state:

> The data behind this view is derived from a classification worksheet created
> inside the Suffolk County District Attorney's office in 2020, applied to
> charge records by charge description. The table and the downloadable
> spreadsheet are derived; the original worksheet is not distributed. Counts
> cover the full datasets and ignore any active filters.

## Gate, test and build results

- `scripts/prepare_dtp_lists.py` re-run on the committed state: **16 of 16
  gates PASS**, "all gates passed. 1300 rows." The re-run's JSON is
  byte-identical to the committed file; the XLSX differs only in
  `docProps/core.xml`'s created/modified timestamps (every sheet XML compares
  equal), so the committed bytes were restored and the tree is clean.
- `npm run test`: **84/84**, 3 files.
- `npm run build`: clean, same pre-existing >500 kB chunk advisory as master.
- `dist/data/dtp-lists.json` and `dist/downloads/suffolk-dtp-lists.xlsx` are
  md5-identical to their `public/` sources; the new provenance sentence is
  present in the built JS chunk.
- `git diff 3727e67 -- package-lock.json` is empty.
- Dash sweep over `src/ui/dtpModel.ts`, `src/ui/DtpBrowseTab.tsx`,
  `scripts/prepare_dtp_lists.py`, `public/data/dtp-lists.json`: no em dash, en
  dash, figure dash, horizontal bar, minus sign or non-breaking hyphen.

## Observations, not applied

- The `Proposed, rejected` card's paragraph 2 ends "That is the documented
  inconsistency noted above." The caveat it points at renders *below* the cards
  in `renderSection()`, so the direction is wrong in the same way I5's "above"
  was. The pass did not raise it and no ruling covers it, so the copy is
  unchanged. One-line fix available if a later wave wants it: "noted in the
  caveat below."
- `DTP_CAVEAT`'s first sentence still says "descriptions the review tab
  rejected", the wording M2 replaced on the YY card. The pass reviewed the
  caveat explicitly and flagged only "above" (I5) and "this project" (M3), so
  it was left alone rather than extended past the findings.

---

# Re-review round: `3566bd4` "DTP modal: chip labels say what the numbers count"

The content re-review verdicted the wave 14 addressed, both Criticals confirmed
fixed from source, and found that four of the new labels or sentences broke on
their own terms. One commit, `src/ui/dtpModel.ts` +
`src/ui/DtpBrowseTab.tsx` + `docs/specs/dtp-ground-truth-results.md`. No value
changed, so no test needed extending.

| # | Severity | Status | Change |
|---|---|---|---|
| NB1 | Important | applied | Agreed card chip: "Charge types marked agreed" becomes **"Descriptions marked agreed"** = 76. The 107 rows give 105, 101 or 68 distinct types under three derivations and never 76; the 76 is the header's own count and tracks rows carrying a reviewer response |
| NB2 | Important | applied | Rejected card chip: "Distinct strings" becomes **"Strings left after precedence"** = 16. All 17 raw rows are distinct strings; the 16 is post-precedence. "Review rows" = 17 unchanged |
| NB3 | Minor | **deferred by ruling** | The flag tooltip's "YY tab" is defined in `DTP_CAVEAT`, which is the deep-link entry path to those rows. Recorded, no change |
| NB4 | Minor | applied | Browse provenance: **"Counts cover each dataset's filed charges and ignore any active filters."** Both columns are `filed_in_window` only, narrower than either file |
| NB5 | Minor | applied | `DTP_CAVEAT` sentence 1 now says "descriptions the review tab **marked disagreed**", matching the YY card's wording after M2. One word for one thing on one screen |

Caveat as rendered after NB5, checked whole:

> These two groupings overlap imperfectly: some charges tagged as on the decline
> list carry descriptions the review tab marked disagreed. The worksheet itself
> contains the conflict, and the tagging here preserves it. The decline-list
> tags come from the classification's broader YY tab; the operative 46-string
> list is the narrower set under Review status.

Doc rows updated: the relocation table's rows 14 and 17 name the shipped labels
and record why R3's and R6's wording was superseded; the fix-wave table's I1 and
I4 rows carry "R3, then NB1" and "R6, then NB2"; the I8 bullet quotes the
corrected sentence and notes the overstatement it replaced. A new "Re-review
round: the relabels' own breakage" section carries all five NB items with the
NB3 ruling.

`npm run test` **84/84**, 3 files. `npm run build` clean. Dash sweep over both
touched TS files: none.
