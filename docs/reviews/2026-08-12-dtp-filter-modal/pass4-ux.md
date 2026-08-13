# DTP filter modal — adversarial review pass 4 of 5 (UX / accessibility)

Branch: `dtp-filter-modal`. Driven live against `npm run dev -- --port 5188`
with Playwright MCP (`browser_navigate`, `browser_snapshot`, `browser_click`,
`browser_evaluate`, `browser_press_key`, `browser_resize`,
`browser_take_screenshot`). `location.href` confirmed after every navigate
(`http://localhost:5188/#e30` at rest). Code read: `src/ui/DtpFilterModal.tsx`,
`src/ui/Modal.tsx`, `src/ui/FilterPanel.tsx`, `src/styles.css`. Server killed
at the end of the pass (`lsof -ti:5188 | xargs kill`).

Screenshots in `/tmp/dtp-p4-shots/` (not committed; referenced here by
filename). Server ran on port 5188 to avoid the port-5177 tab-contention issue
pass 1 flagged for passes that share a browser session with pass 5.

## Methodology note: three visual false alarms, caught before writing them up

Three separate times in this pass a screenshot looked wrong to the eye and
turned out to be correct on inspection with tools that don't rely on my own
color perception (`getComputedStyle`, raw PNG pixel sampling via PIL,
`getBoundingClientRect`). Recording this because it changes how much weight to
give a "looks off" visual read without corroboration:

1. **Dark mode looked like the modal ignored the theme** (white card on a dark
   page). `getComputedStyle` reported the dialog background as `#1a1a19`
   (correct dark value) the whole time. Cropped and re-examined the same PNG
   (`04d-dialog-crop.png`) and it is in fact dark; a Python pixel sample at
   several interior points returned `rgb(26,26,25)`, matching `--surface` in
   the dark token block exactly. False alarm.
2. **At 1100px, the Filters drawer's "FILTERS ×" header looked undimmed**,
   as if it were rendering above the dialog's backdrop. Pixel math resolved
   it: `rgba(11,11,11,.45)` over a white background predicts
   `rgb(~145,145,145)`; the sampled pixel was `rgb(142,142,142)`. The drawer
   is dimmed exactly as much as everything else behind the backdrop. False
   alarm.
3. Following on from (2), suspected the drawer might still be *interactive*
   under the dimming (a real bug, if true — a `position:fixed; z-index:60`
   element in theory shouldn't out-stack a native top-layer `<dialog>`, so
   its apparent visibility invited a closer look). A real Playwright click at
   the drawer's "Close filters" button timed out with Playwright's own error:
   `<dialog open... class="modal modal-wide"> intercepts pointer events`. The
   browser's real hit-testing blocks the click. `element.inert` reads `false`
   on the drawer (Chromium doesn't reflect the modal-dialog blocking through
   that IDL property), which is a trap for JS-only inspection but not what a
   mouse or keyboard user experiences. False alarm, confirmed with a real
   click, not a JS-dispatched one.

None of these are reported as findings below. They're recorded here so a
re-reviewer doesn't have to redo the same investigation from a screenshot that
looks suspicious at first glance.

## Per-check results

| # | Check | Result |
|---|-------|--------|
| 1 | Keyboard-only walkthrough (Tab to Filters → DTP row → Enter → tab order inside → Space/Enter → Esc → focus return) | PASS (1 Minor) |
| 2 | Accessibility tree (checkbox names, count `aria-label`s, dialog title, section landmarks) | PASS (1 Minor, previously deferred) |
| 3 | Viewports 1440 / 1100 / 1000 / 800 / 390 (opens, scrolls inside dialog, footer reachable, no horizontal overflow) | PASS |
| 4 | Dark mode contrast (cards, counts, caveat strip `--warn`, disclosure summaries) | PASS |
| 5 | Zoom (200% via `body.style.zoom`) | PASS |
| 6 | Long content: all 10 disclosures open at 390px | PASS |
| 7 | Visual polish at 1440px (missing chevron; label squeeze under active filter) | Both still present, unchanged from task 4's report — Minor, not promoted |

**0 Critical, 0 Important, 3 Minor (1 new, 2 reconfirmed-unchanged).**

## Findings

### Minor — forward Tab from the last button makes one silent stop on `<body>` before wrapping to Close

**Repro:** Open the modal (click the "Decline-to-prosecute" row, or Enter on
it with keyboard focus). Tab all the way to Apply (last footer button). Press
Tab once more: `document.activeElement` becomes `<body>` (`document.body`,
`tabIndex -1`, not part of the dialog) — no visible focus ring anywhere. Press
Tab a second time: focus lands correctly on the dialog's Close (X) button.
Shift+Tab from Close goes straight back to Apply with no phantom stop; the
extra stop only happens on the forward direction after the last element.

**Why it's Minor, not Important:** the "trap" language in the brief is
reserved for focus escaping the dialog into interactive background content,
or a control becoming unreachable. Neither happens here — `document.body` is
not focusable in the sense of receiving a visible indicator or accepting
input, and the very next Tab reliably wraps into the dialog. This is a known,
widely-documented behavior of Chromium's native `<dialog>` focus-wrap
implementation (WHATWG/Chromium tracked this class of issue; forward-wrap via
`<body>` is common, backward-wrap is usually clean, matching what was
observed here). It is not introduced by this feature's code — `Modal.tsx`
does not implement its own focus-trap logic; it relies entirely on
`showModal()`. A keyboard user would perceive one "dead" Tab press with focus
seemingly vanishing, then it reappears on Close. Not disorienting enough to
block shipping, worth a one-line mention if the team ever revisits `Modal.tsx`
for a hand-rolled trap (which would fix it but adds real complexity for a
Chromium quirk, not an app bug).

### Minor (reconfirmed, previously deferred at task 3) — section `aria-label` duplicates the visible `h3`

**Repro:** `browser_snapshot` with the modal open shows
`region "The decline list" ... heading "The decline list of 161,134 charges in the current view"`
— the region's accessible name repeats the heading's leading text. A
screen-reader user entering the region hears "The decline list, region," then
immediately "The decline list of 161,134 charges in the current view,
heading level 3." Same for "Review status."

**Severity assessment (live, as requested):** still Minor. It is a one-time,
mild verbosity per section (2 sections total, not a per-card repeat), it does
not misdirect or block anything, and the two sections remain clearly
distinguishable by name either way (satisfying the actual "are sections
distinguishable" requirement). `aria-labelledby` pointing at the `h3` would
remove the duplication cheaply, but nothing here promotes it above the task 3
finding's original severity.

### Minor (reconfirmed, unchanged from task 4) — DTP sidebar row still lacks the chevron/indent sibling rows have

**Repro:** `02-1440-sidebar-chevron.png`, cropped from the Case filter group.
"Crime type," "Court," "Case status," etc. each show a small `▸`-style
chevron before the label and an indent; "Decline-to-prosecute" has neither,
sitting flush left with a name only. The row is still fully clickable/keyboard
operable (confirmed under check 1) — this is cosmetic misalignment, not a
functional gap. No change from the description already on file
(`progress.md` line 18).

### Minor (reconfirmed, unchanged from task 4) — active-filter label still squeezes to "Decline-t…"

**Repro:** `03-1440-filter-active-squeeze.png`. Checked "On the decline list,"
clicked Apply. In the resulting filtered view the sidebar row's own label
truncates to "Decline-t…" and its value chip to "On the decline list ·
revie…". Both ellipses are legible in context (it's the only row whose label
starts with "Decline"), and the "Active" filter-chips section at the top of
the panel separately renders the full un-truncated label
("Decline-to-prosecute list: YY (de…) ×"), so the information isn't lost,
just repeated in truncated form at the row itself. No change from the
description on file (`progress.md` line 19); not worse.

## Detail on checks worth narrating

**Check 1, full path.** Landed on the page fresh (`http://localhost:5188/#e30`
after `browser_navigate`). Two real `Tab` presses reached the "Filters"
button (topbar); confirmed the toggle both closes (`aria-pressed="false"`,
`.fpanel` removed from DOM, focus stays on the button) and reopens without
losing focus. Continued Tab (verified with real `Tab` keypresses, not
simulated focus) through the Filters panel's Case group to the
"Decline-to-prosecute" row (button, `aria-haspopup="dialog"`), 19 real Tab
presses from the Filters button. `Enter` opened the dialog; initial focus
landed on the header Close button (native `showModal()` default: first
focusable descendant, not something this feature's code controls). From
there, real Tab presses confirmed the order specified in the design doc
exactly: Close → header `<summary>` → (Enter opens it, second Enter closes
it) → card 1 checkbox → card 1 `<summary>` "More" → card 2 checkbox → card 2
"More" → ... → card 5 (last card, section 1) → jumps directly to section 2's
first checkbox (the intervening caveat `<p>` is correctly skipped, it isn't
focusable) → same card/More pattern through section 2's 4 cards → Clear both
→ Cancel → Apply. `Space` toggled a checkbox (`checked` flipped both
directions); `Enter` on the header summary opened/closed the native
`<details>` (`.open` property flipped). `Escape` closed the dialog and
returned focus to `document.activeElement` = the "Decline-to-prosecute" row
button, both via keyboard-close (Esc) and via a real click on the Cancel
button. Also verified "Clear both" via keyboard specifically: checked a box,
tabbed/focused "Clear both," pressed `Enter` — checkbox unchecked, dialog
stayed open (`!!document.querySelector('dialog')` true), focus stayed on
"Clear both." One methodology trap self-caught mid-pass: an earlier attempt
to "reopen" the dialog by calling the raw DOM `dialog.close()` and then
re-clicking the opener button produced a nonsense read (checkbox appeared to
stay checked after "Clear both") because the raw `.close()` bypasses React's
`dtpOpen` state entirely, leaving `setDtpOpen(true)` a no-op on the
already-true state and the dialog never actually reopened — re-ran the whole
sequence from a fresh `browser_navigate` and it behaved correctly. Not a
finding; a note for anyone re-running this pass not to drive `<dialog>` via
raw DOM calls when React owns its mount state.

**Check 2, accessibility tree.** Full snapshot with the modal open: dialog
node is `dialog "Decline-to-prosecute categories"` (accessible name via
`aria-label` on `Modal.tsx`'s `<dialog>`, not just the visible `<h2>` — either
would satisfy "has an accessible title," this feature gets both). Every
checkbox's accessible name is the concatenation of its `<label>`'s text
content, e.g. `checkbox "On the decline list 39106 charges"` — the
card-name span contributes "On the decline list" and the count span
contributes "39106 charges" via its own `aria-label` (the raw unformatted
number, not the visually displayed "39,106" — that's `DtpFilterModal.tsx`
line 96's `aria-label={\`${count} charges\`}` overriding the span's own text
node for accessible-name computation, while the visible text keeps the
comma-formatted version from `fmt()`). This means sighted-and-screen-reader
dual users would see "39,106" but hear "39106" — a harmless mismatch, not
worth a finding since neither number is wrong, just formatted differently
across the two channels. Two sections render as `region "The decline list"`
and `region "Review status"` (landmark role from `aria-label` on the
`<section>`), clearly distinguishable from each other; the aria-label/h3
duplication is the Minor finding above.

**Check 3, viewports.** At each of 1440 / 1100 / 1000 / 800 / 390:
`document.documentElement.scrollWidth === window.innerWidth` (no horizontal
overflow) and `document.body.style.overflow === 'hidden'` while the modal is
open (background page cannot scroll; `Modal.tsx` sets this directly). At
1440/1100 the Filters sidebar starts open (`window.innerWidth > 1100` at
mount); at 1000/800/390 it starts closed and was opened via the Filters
button first (matching how a narrow-viewport session actually begins), then
the DTP row inside the drawer was clicked to open the modal on top of it —
this is the realistic path at those widths, not an edge case. `.modal-body`
has `overflow-y: auto` with `scrollHeight` (1158px at 1440, un-narrowed
content) exceeding `clientHeight` (739px), confirmed scrolling reaches the
footer at every width including 390px with every disclosure expanded
(screenshots `09-390-scrolled-footer.png` through
`12-390-alldisclosures-bottom.png`). Caveat strip (left amber border,
white/dark text) stayed fully legible and un-clipped at every width tested,
including with its text wrapping to 4-5 lines at 390px.

**Check 4, dark mode.** See methodology note above for the false start.
Confirmed via `getComputedStyle` and pixel sampling: dialog background
`#1a1a19` / `rgb(26,26,25)`, all card/caveat/summary/count text
`rgb(255,255,255)` (full white) against that background — a contrast ratio
far above WCAG AA for any text size. `.dtp-denom` (the "of N charges..."
secondary text) and `.dtp-card-count` use `opacity: 0.7` / `0.8` rather than a
separate muted color token to de-emphasize; `getComputedStyle().color` still
reports pure white for both because `opacity` doesn't change the `color`
computed value, only the final composited alpha — this is expected, not a
bug. Checked whether `--warn` (`#fab219`, used for the caveat's left border
and a 7%-mix background tint) is redefined for dark mode: it is not — neither
the `@media (prefers-color-scheme: dark)` block nor the
`:root[data-theme='dark']` block override `--warn`/`--good`/`--crit`, only
the neutral/accent tokens. This is fine here specifically because `--warn` is
used decoratively (a border and a very light background tint), never as
foreground text color, and amber-on-near-black already has strong contrast.
Flagging the shared-value fact for the record since the brief called this out
by name, but it produces no readability problem in this feature as built.

**Check 5, zoom.** `document.body.style.zoom = '2'` was used per the brief's
suggested approximation. First read of `getComputedStyle(dialog).zoom` came
back `"1"` even with `body`'s zoom at `"2"`, which looked like the top-layer
promotion was breaking zoom inheritance into the dialog's subtree — a second
near-miss investigation. Resolved by comparing real geometry instead of the
unreliable computed-style property: the dialog's own `<h2>` measured
`width: 222.66px` at zoom 1 and `width: 445.32px` at zoom 2 (exactly 2.0x,
same for height), proving the dialog *is* correctly scaled and that
`getComputedStyle(...).zoom` simply doesn't reflect an inherited zoom factor
in Chromium (a reporting quirk, not a rendering one). Screenshots at 200%
(`13-1440-zoom200.png`, `14-1440-zoom200-footer.png`) show text scaled up
cleanly with no clipping or overlap in either the header/lede or deep into a
scrolled section-2 card.

**Check 6, long content.** All 10 `<summary>` elements in the dialog
(`document.querySelectorAll('dialog summary')`, 1 header + 5 cards section 1
+ 4 cards section 2) opened simultaneously via `.click()` at 390px width.
`.modal-body.scrollHeight` grew from 1498px to 3043px; `document.documentElement.scrollWidth`
stayed at 390 (no horizontal overflow introduced by the expanded prose, some
of which contains long unbroken strings like statute citations —
`"c. 266 s. 127"` vs `"c266 §127"` — that could in principle have forced
width). Scrolled through top/middle/bottom (`10-`, `11-`, `12-390-*.png`):
every expanded paragraph wraps within the card, footer buttons remain visible
and unclipped at the bottom of the fully-expanded scroll.

**Check 7, visual polish re-check.** Both previously-deferred minors
(missing chevron, label-squeeze) were re-screenshotted fresh on this branch
and are visually identical in kind and severity to their task 4 description —
neither has regressed further, and neither meets the bar for promotion to
Important (both are cosmetic-only; the affected controls remain fully
operable by mouse, keyboard, and screen reader, confirmed under checks 1-2
above).

## Bottom line

Zero Critical or Important UX/accessibility findings; the modal is fully
keyboard-operable start to finish including focus return, holds up cleanly
from 1440px down to 390px with internal scrolling and no horizontal overflow,
and dark mode is correctly themed throughout (verified computationally after
an initial visual misread). Three Minor findings, none new in substance: a
Chromium-native one-stop phantom Tab on forward-wrap (new observation, not an
app bug), and the two already-deferred cosmetic sidebar issues plus the
already-deferred aria-label/h3 duplication, all reconfirmed unchanged.
