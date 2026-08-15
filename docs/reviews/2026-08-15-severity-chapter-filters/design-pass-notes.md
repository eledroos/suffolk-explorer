# Design pass: severity and chapter modal polish

Date: 2026-08-15. Branch severity-chapter-filters, base 7ceda50.
Method: the repo's impeccable skill (v4.0.4), polish reference, Operate mode,
one bounded inspection round before editing and one after. The DTP filter
modal is the incumbent visual authority; every change either copies its
pattern or aligns a drift back to it. Files touched: src/styles.css (scoped
to the severity/chapter section plus one element-scoped rule that cannot
reach the DTP modal), SeverityFilterModal.tsx and ChapterFilterModal.tsx
(markup only). Protected files untouched.

## Refinements

1. **Severity modal: denominator line added.** The DTP modal states its
   counts' denominator ("of 161,134 charges in the current view" in
   .dtp-denom typography under each section title); the severity cards
   showed bare counts with no stated universe. Added
   `<p class="dtp-denom">of {total} charges in the current view</p>`
   directly above the card list, exact sibling phrasing, using the `total`
   the component already computes. (SeverityFilterModal.tsx)

2. **Chapter modal: same denominator, placed in the search row's dead
   space.** The 260px search input left the right two-thirds of its row
   empty; the denominator right-aligns there (space-between flex row,
   `.chapter-controls`), wrapping below the input left-aligned at phone
   widths. (ChapterFilterModal.tsx + styles.css)

3. **Chapter row share bar aligned to the first line.** The bar had
   `align-self: center`, which on a two-line row (every row with a chapter
   title) floated it ~7px below the count while count and link pinned to
   line 1 — contradicting the CSS comment's own stated intent. Now
   `align-self: start; margin-top: 8px`: measured centers after the change
   are value 241.0 / count 241.8 / bar 241.4 / link 241.9, i.e. one aligned
   metric cluster. The 560px media query resets both offsets since its
   first grid row is a single shared 26px track where centering is correct.

4. **Chapter link icon optical alignment.** The 26px icon-btn's glyph
   center sat ~3px below the count's centerline; `margin-top: -3px` on
   `.chapter-row-link` (desktop only, reset in the media query).

5. **Chapter share-bar column widened 84px → 112px.** The measure was
   cramped for a 760px dialog next to the DTP/severity bars' 620px track;
   the extra 28px comes out of the title column, whose longest single-line
   title still fits.

6. **Chapter count typography matched to the sibling cards.**
   `.chapter-row-count` was weight 400 resting and jumped to 600 when
   checked; `.dtp-card-count` is 500 resting and shifts color only. Now
   both do the same (500, checked = ink1 color shift), so digits never
   change width on toggle.

7. **Chapter row state transition matched to DTP cards.** Rows snapped
   between hover/checked backgrounds; `.dtp-card` fades border and fill at
   140ms. Added `transition: background-color 140ms ease` to
   `.chapter-row`. (The DTP modal's 180ms width transition already applies
   to both new dialogs via `:has(.dtp-modal)` but is inert there since
   neither changes width — checked, nothing to do.)

8. **Spacing rhythm for the severity denominator.**
   `.severity-modal > p.dtp-denom { margin-bottom: -6px }` closes the
   14px column gap to 8px below it, the same title-to-list distance
   `.dtp-section-title` keeps in the DTP modal, so the annotation binds to
   the list it describes rather than floating between blocks. `p.dtp-denom
   { margin: 0 }` is element-scoped: the DTP modal's only .dtp-denom is a
   span inside its h3 and cannot match either rule.

## Verified, no change needed

- Both filter-panel entries (Severity / Statute chapter) render the
  dtp-entry two-line pattern correctly, inactive ("any") and active
  (accent label + dot + summary line). FilterPanel.tsx is protected;
  nothing needed.
- Coverage banner interaction: with history on and a Felony-only filter
  applied, the "Severity filter excludes 2006-2021" info notice appears
  above the chart in the standard notice dress with a dismiss control, and
  the modal's history card ("Not graded (pre-2022)", 874,107) carries an
  84.4% share bar against the 1,035,241-row view. Bar percentages
  spot-checked against computed style widths.
- Severity card anatomy is class-for-class the DTP card; checked state,
  More disclosure, and footnote (history off) all match.
- Empty search state ("No chapter matches ...") renders in the tablewrap
  frame; denominator remains true in that state.
- Escape-in-search cancel path still closes only the modal (existing
  behavior, logic untouched).

## Screenshot matrix (before/after)

Saved to /private/tmp/claude-501/-Users-nasser--dev-nasser-blog-posts/e47ce932-d484-4d13-87a5-dcd980df9789/scratchpad/design-pass-shots/:
before-severity-desktop-{dark,light}.png, before-severity-checked-more-light.png,
before-severity-history-dark.png, before-severity-390-dark.png,
before-chapter-desktop-light.png, before-chapter-desktop-dark-checked.png,
before-chapter-bottom-dark.png, before-chapter-empty-dark.png,
before-chapter-390-dark.png, before-banner-and-entry-dark.png,
ref-dtp-desktop-dark.png (incumbent reference),
after-severity-desktop-{dark,light}.png, after-severity-390-{dark,light}.png,
after-chapter-desktop-{dark,light}.png, after-chapter-390-{dark,light}.png.

## Gates

- `node .agents/skills/impeccable/scripts/detect.mjs`: one warning, the
  pre-existing DTP width transition (styles.css:1906), documented in the
  CSS as a deliberate measured exception; not introduced by this pass.
- `npx vitest run`: 130/130 passed.
- `npm run build`: green.

## Parked (per brief, not chased)

- Native-dialog tab-wrap alternation.
- Backdrop-click focus placement.
