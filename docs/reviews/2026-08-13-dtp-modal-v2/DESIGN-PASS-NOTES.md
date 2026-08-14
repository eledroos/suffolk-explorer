# DTP modal, design pass

Run with the repo's `impeccable` skill: `polish` on an Operate-mode surface,
against `src/ui/DtpFilterModal.tsx`. Refinement, not redesign. The incumbent
tokens, component vocabulary and every user-facing string are unchanged; the
diff is layout, state and spacing.

## The complaint

The dialog is one width for three tabs. Tab 3 (Browse the lists) needed 880px
for its table, so `Modal`'s `wide` flag was set and tabs 1 and 2 kept their
620px reading column inside it, left-aligned. That left a 245px dead column on
the right of the two tabs a reader spends most of their time in.

## What the width now does

The dialog is sized by the tab that is open rather than by the widest tab.
Tabs 1 and 2 are prose plus a checkable list; 620px is the right measure for
both, so the dialog hugs that column at 654px and the gutters come out even at
17px on each side. Tab 3 is a five-column table over 1,300 rows, so the dialog
opens out to 1,000px, which is what it takes to show all five columns at a
desktop width.

Two rules follow from this and they are worth stating because they decide
every other layout question in the modal:

- Prose keeps a reading measure at every dialog width. The lede, the header
  disclosure and the Browse tab's provenance note stay capped at 620px. On tab
  3 that leaves space beside the paragraph, and that is correct: the paragraph
  is not the thing the width is for.
- Everything that is not prose uses the width it is given. The table, the
  action row, the header band on tab 3.

The alternative was to keep one wide dialog and fill tabs 1 and 2 with a card
grid or a side rail. That fails the first rule: it either sets a 110-character
measure on the card sentences or moves the caveat and the header into a new
information architecture, which is redesign rather than polish.

The width change is animated over 180ms. A width transition is a layout
animation, taken here as a deliberate exception to the usual rule against
them: it is the only property that can express the change, it runs once per
tab click, and with `table-layout: fixed` the relayout it forces measures 0.4
to 0.6ms with all 1,300 rows mounted. The app's global
`prefers-reduced-motion` rule cancels it.

Implementation is CSS only, keyed on the panel classes with `:has()`, so
`Modal.tsx` keeps its single `wide` flag and `CategoryBuilder`, the other
`modal-wide` user, is untouched.

## The rest of the pass

**Card selection had no visual state.** The checkbox was the only signal that
a category was staged, which is too small to scan across five cards. Checked
cards now carry an accent-tinted border and fill, the count goes to `--ink1`,
and the share bar fills to full accent. Hover gets a border-color response.

**The share bar was reading as an underline of the card header.** It started
at the checkbox and ran the full card width. It now starts at the card text's
left edge, aligned with the sentence below it, so it reads as a measure of the
row above it. Its track is mixed from `--axis` rather than `--accent`, which
leaves the accent to mean data and selection rather than decoration. A
category with zero charges draws no fill at all, so the new 2px minimum never
renders a zero as a visible stub.

**The caveat was a one-off.** A 3px colored left border is not in this app's
vocabulary anywhere else, and warnings elsewhere are `.notice-warn`: a 1px
tinted border with a 7% fill at a 6px radius. The caveat now takes that
treatment, which also puts it in the same color language as the Browse tab's
conflict rows.

**Apply was below the fold.** At a 1,000px-tall window the modal body already
overflows on tab 1, and the action row scrolled off with the content. It is
now sticky to the bottom of the body with a hairline above it. On these two
tabs the row supplies the body's bottom padding itself, so its stuck position
and its flow position are the same place and nothing settles at the end of the
scroll.

**Spacing came from two sources.** The flex column's 14px gap and the blocks'
own bottom margins were compounding. The gap now owns the distance between
blocks and the blocks carry no trailing margins, which also fixes the double
space under the last paragraph of every expanded "More" panel.

**The Browse table forced a horizontal scroll it did not need.** Every cell
was `nowrap`, so one 650px outlier charge description set the column width for
all 1,300 rows and pushed both count columns off screen at 880px. The table is
now `table-layout: fixed`: the four short columns are pinned at the widths
their longest chip and header actually need, and the description column takes
the remainder and wraps. All five columns are visible from about 960px up. A
`min-width` keeps the horizontal scroll below tablet widths, where five
columns genuinely do not fit.

**Smaller items in the same pass.** The XLSX download moved out of its own
nearly empty row and into the header band beside the provenance note, and
picked up the same `IconDownload` the CSV button in the top bar uses. `.btn`
now clears the anchor underline, since that button is the one `<a>` wearing
the class. Fact chips take the raised `color-mix(--ink1 3%)` fill that
`.about-stat` uses, so they read the same way in both themes rather than
inverting. Conflict rows in the Browse table got their own hover rule; they
were painted after `.aggtable`'s and were the only rows in the table that did
not respond. The tab bar tightens its type below 560px, where "Decline list"
plus its staged count was wrapping onto a second line while the other two tabs
stayed on one.

## What was verified

Both themes at 1440, 1000 and 390, all three tabs. Screenshots for the owner
are outside the repo, in `.playwright-mcp/dtp-design-pass/final/`.

The shipped accessibility invariants were re-checked after the changes and all
hold: the tablist's label, `aria-selected`, `aria-controls` and roving
`tabindex`; left and right arrow keys moving both selection and focus; the
caveat deep-link landing focus on the Browse tab button with the Conflicts
chip active; count accessible names with real spaces ("39106 charges"); share
bars `aria-hidden`; `:modal` focus containment; and Esc closing the dialog and
returning focus to the sidebar entry that opened it. Staging still applies
correctly: checking "On the decline list" and pressing Apply filters the view
to 39,106 charges, matching the card's own count.

`npm run test` 84/84 and `npm run build` clean.
