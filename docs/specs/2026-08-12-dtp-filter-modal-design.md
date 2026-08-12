# DTP filter modal — design

2026-08-12. Approved approach: a purpose-built modal (option A), replacing the
two sidebar DTP MultiSelects. Approved by Nasser with the instruction that
verification run as multiple adversarial reviews from different angles.

## Goal

The decline-to-prosecute categories are the most analytically loaded columns in
the explorer and the most cryptic. `dtp_class` values read "YY (decline list)",
"NY (presumption against)"; `dtp_review` values read "Proposed, agreed (never
adopted)". Nobody who wasn't in the room can filter on these with confidence.
The feature gives them one place to learn what the categories mean and set the
filter in the same motion.

## Non-goals

- No engine changes, no `contract.ts` changes, no new columns. The modal writes
  the existing `dtp_class` and `dtp_review` entries of `view.filters` through
  the existing `onSetFilter` path.
- No change to how the two filters compose with each other or with anything
  else. Checked values OR within a column, the two columns AND, exactly as two
  MultiSelects do today.
- Not a general described-filter framework. One purpose-built modal; if a
  second column ever needs explanations, generalize then.

## UI structure

**Sidebar.** In the Case filter group, the `dtp_class` and `dtp_review`
MultiSelects are replaced by one entry labelled "Decline-to-prosecute". It
shows the active selection compactly ("any", or e.g. "On the list + Presumption
against · review: any") and an Edit button that opens the modal. Active
selections keep appearing as removable chips exactly as today, since the chips
read `view.filters` and the keys are unchanged.

**Modal.** Built on the existing `Modal` component (`src/ui/Modal.tsx`, native
`<dialog>`, focus containment, Esc, `wide` variant). Title:
"Decline-to-prosecute categories". Two sections:

1. **The decline list** (`dtp_class`) — five cards: YY, NY, NS, NN, Not
   listed.
2. **Review status** (`dtp_review`) — four cards: Current list; Proposed,
   agreed (never adopted); Proposed, disagreed; Not reviewed.

Each card: checkbox, display name, one-sentence plain-language summary always
visible, live count at the right edge, and a "More" disclosure that expands the
expert layer (provenance, what is inside, caveats). One caveat strip sits
between the sections, flagging the YY/review-tab overlap (below). Footer:
Apply, Cancel, Clear both.

A short header paragraph (two sentences) explains what a decline list is at
all, with a "More about where these categories come from" disclosure carrying
the provenance story.

## Content (draft copy; verify against sources before shipping)

Stored as a typed constant `DTP_CONTENT` in the modal file. Layer 1 must be
readable by a voter; layer 2 is for Bobby. Draft:

Header, layer 1: "In 2019 the Rollins administration published a list of
charges the office would presume not to prosecute. These categories tag every
charge in this data by where it stands relative to that list. They describe
the charge type, not what happened to the individual case."

- **YY, On the decline list.** L1: "Charge types on the office's operative
  decline-to-prosecute list." L2: origin (Rollins memo list as operationalized
  in `SCDAO-DTP-Classification.xlsx`, applied by charge description,
  whitespace-normalized with a 75-character fallback for truncated
  descriptions); the caveat that 2,393 filed charges classed YY carry strings
  the review tab lists as proposed-but-disagreed, ruling pending.
- **NY, Presumption against.** L1: "Charge types the office presumes against
  prosecuting, short of the formal list." L2: source and count context.
- **NS, Case-by-case.** L1: "Charge types the office weighs one case at a
  time." L2: same.
- **NN, Prosecute.** L1: "Charge types the office ordinarily prosecutes." L2:
  same.
- **Not listed.** L1: "Charge descriptions that match nothing in the
  classification, about 1% of charges." L2: why (truncations, rare variants).
- **Current list.** L1: "The operative 46-charge decline list." L2: from the
  workbook's YY REVIEW tab; precedence current > agreed > disagreed on the one
  overlapping string.
- **Proposed, agreed (never adopted).** L1: "A working group agreed to expand
  the list by 76 charges; the expansion was never adopted as policy." L2: 107
  statute-variant strings; what filtering on it means.
- **Proposed, disagreed.** L1: "Proposed for the expansion; the working group
  said no." L2: the 17 strings; overlap with YY.
- **Not reviewed.** L1: "Everything the review never looked at." L2: scale
  (the large majority of charges).

Caveat strip: "These two groupings overlap imperfectly: some charges tagged YY
carry descriptions the review tab rejected. That inconsistency is in the source
classification, is documented in the data README, and a ruling is pending."

Every factual sentence must be verified against
`data/suffolk-package/reference/SCDAO-DTP-Classification.xlsx`, the workbook's
YY REVIEW tab, and `data/assembled/README.md` during implementation. Exact
counts named in copy (46, 76, 17, 107, 2,393, ~1%) are re-derived, not trusted
from this spec.

## State and semantics

- Modal opens with staged local state initialized from `view.filters`. Apply
  writes both keys in one action each through `onSetFilter`; Cancel discards;
  "Clear both" stages empty selections (user still confirms with Apply).
- Empty selection for a column = no filter on that column ("any"), same as
  today's MultiSelect with nothing checked. On Apply, a section with every box
  checked normalizes to an empty selection, mirroring MultiSelect exactly
  (`MultiSelect.tsx` line 36: a full selection becomes `[]` to keep URLs
  short). Normalization runs against the union of known cards and any
  unknown values present in the data, not the card count alone.
- **Unknown values.** If `distinctValues()` returns a `dtp_class` or
  `dtp_review` value not in `DTP_CONTENT`, the modal renders it as a bare
  card (checkbox, value, count, no prose) rather than dropping it. A filter
  UI that silently hides a value that exists in the data corrupts the "every
  box checked = any" normalization and can strand an applied filter with no
  way to see it.
- When both sections have selections, a footnote states the AND: "Showing
  charges matching a checked decline-list category AND a checked review
  status."
- View-state URL encoding (`encodeView`/`decodeView`) is untouched; the keys
  are the same.

## Live counts

- On open, run the engine's public `aggregate()` twice with a derived
  ViewState: `x` = `dtp_class` then `dtp_review`, `series` = null, measure =
  charges, granularity irrelevant, and the two DTP keys removed from
  `filters`; lens, date range, and every other filter intact.
- Each card shows its count under the current lens plus other filters; a
  header line names the denominator ("of N charges in the current view").
- Counts cache on the (view minus DTP filters) signature and recompute when it
  changes. While computing, show an em-dash, not 0.
- Zero-count categories stay selectable and visible, with the count shown as 0.

## Accessibility

Native dialog focus containment from `Modal`. Cards are real `<label>`s over
checkboxes; disclosures are `<details>/<summary>` or buttons with
`aria-expanded`; counts carry `aria-label` context; the whole modal operates by
keyboard. Focus returns to the Edit button on close (Modal already does this).

## Verification: multiple adversarial reviews, different angles

Per Nasser's instruction, review is layered, each pass tries to break the
feature rather than confirm it:

1. **Numbers.** Every count the modal can show is recomputed in duckdb from
   `hayden.parquet` under a battery of filter/lens/date combinations,
   including: other filters active, custom-grouping filters active, empty
   result sets, and the dispositions lens. Any mismatch is a bug, and the
   ground-truth queries are committed alongside the feature.
2. **Content.** Every factual sentence in `DTP_CONTENT` is checked against the
   primary sources named above. A sentence that cannot be pinned to a source
   is cut. Counts inside prose are re-derived.
3. **State machine.** Attack the staging semantics: open-edit-cancel leaves
   state untouched; apply-then-reopen round-trips; chips removed while the
   modal is closed are reflected on next open; select-all normalization agrees
   with MultiSelect; URL round-trip of an applied DTP filter reproduces the
   view; localStorage groupings interplay.
4. **UX and accessibility.** Keyboard-only walkthrough, screen-reader labels,
   focus return, small-viewport (the sidebar is an overlay drawer under
   1100px; the modal must work above it), long-content overflow, dark mode.
5. **Regression.** The removed MultiSelects leave no dead code paths; every
   other filter still works; bundle builds clean; existing engine tests green.

Reviews 1-3 are hard gates: any confirmed finding is fixed before the feature
is called done. The two review passes on the final diff are run as independent
adversarial reads (the repo's standing dual-review convention), one focused on
correctness, one on simplification and UX.

## Rollout

Dev build verified in the browser with screenshots, ground truths pass, then
the normal Cloudflare Pages deploy (Nasser's call when to push).
