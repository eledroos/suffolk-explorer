# UX/accessibility review: severity + statute-chapter filter modals

Branch `severity-chapter-filters`, dev server `http://localhost:5173`, reviewed with
Playwright MCP against a live Chromium instance. All sequences confirmed
`location.href` started with `localhost:5173` before running (single browser
session, no other user). Screenshots referenced below are at
`/Users/nasser/_dev/nasser-blog-posts/.playwright-mcp/round1-ux-screenshots/`.

Surfaces: filter panel &rarr; Case group &rarr; **Severity** (card modal, expandable
More per card) and **Statute chapter** (searchable ~71-row list modal), their
entry-button two-line summaries, the Active chips row, and the
`severity-excludes-history` coverage banner.

## Summary

**13 test-matrix items run, 3 FAIL, 1 CONCERN, rest PASS.** Two other
apparent problems were investigated and ruled out as testing artifacts, not
app bugs (detailed at the end so nobody re-discovers and misreports them).

| # | Area | Result |
|---|---|---|
| 1 | Keyboard-only: Severity modal (tab order, Escape, focus return) | PASS |
| 1 | Keyboard-only: Chapter modal tab order (search, rows, footer) | PASS |
| 1 | Chapter modal initial focus (`autoFocus` on search field) | **FAIL** |
| 1 | Chapter modal Escape-to-close, search field focused | **FAIL** |
| 1 | Chapter modal Escape-to-close, focus elsewhere in modal | PASS |
| 1 | Native `<dialog>` forward-tab wrap (Apply &rarr; body &rarr; Close) | CONCERN (pre-existing, shared with DTP modal) |
| 2 | 390px: both modals open/usable, no horizontal scroll | PASS |
| 2 | 390px: c. 276 (longest title) row alignment | **FAIL** |
| 2 | 390px: entry-button summaries wrap in drawer | PASS |
| 3 | Dark mode / light mode: page, banners, chips, both modals | PASS |
| 4 | Share bars `aria-hidden`, counts carry number via `aria-label` | PASS (both modals) |
| 5 | Chapter search: zero-result, "No statute code"-only match, clear restores pinned list | PASS |
| 6 | Severity modal history off/on (footnote vs. Not-graded card) | PASS |
| 7 | Long-text stress: 3 chapters + severity, 390px chips/summary | PASS |
| 8 | More disclosures, external glyphs, href targets, c.258/c.279C unlinked | PASS |
| 9 | Scroll lock + scrim coverage | PASS |
| 10 | Invented attack: Clear-then-Cancel staging | PASS |
| 10 | Invented attack: single-chip removal + reopen sync | PASS |
| 10 | Invented attack: pathological search input (regex metachars) | PASS |

Copy tone: matches the DTP modal (see final section).

---

## FAIL 1 — Chapter search field's `autoFocus` never actually focuses it

**File:** `src/ui/ChapterFilterModal.tsx:139` (`<input ... autoFocus />`)

**Reproduction:**
1. Open the filter panel, click "Statute chapter."
2. Inspect `document.activeElement` immediately after the dialog opens.

Result: focus is on the header's Close button, not the search field, every
time, confirmed both via manual keyboard Tab-walk and via
`document.activeElement`.

**Root cause (confirmed):** the DOM node has no `autofocus` *content
attribute* —
```
document.querySelector('.chapter-search').hasAttribute('autofocus') === false
```
React implements the `autoFocus` prop by calling `.focus()` imperatively at
mount time, not by setting the attribute. But `Modal.tsx` renders the
`<dialog>` closed (`display: none` via the UA stylesheet) at the moment its
children mount, and calls `showModal()` only afterward, in its own
`useEffect`. `.focus()` on a display:none input is a no-op. When
`showModal()` then runs, the browser's native "dialog focusing steps"
look for a descendant with the real `autofocus` *attribute*; finding none,
they fall back to the first focusable element in tree order — the Close
button.

**Impact:** every keyboard/screen-reader user who opens Statute chapter has
to Tab past Close before reaching the one thing the design brief called out
as the escape hatch for the long-list problem ("Handles the long-text
problem with a searchable modal list"). Design spec
(`docs/specs/2026-08-15-severity-chapter-filters-design.md`) and the prop's
own presence in the code both show this was intended to work.

**Suggested fix:** don't rely on React's `autoFocus` inside a `<dialog>`
that opens via `showModal()`. Either (a) give `Modal` an optional
`initialFocusRef` prop and call `.focus()` on it right after `showModal()`
in the same effect, or (b) have `ChapterFilterModal` focus its own input in
a `useEffect` that runs after mount (a microtask/rAF after `showModal()`
is safe since the dialog is already open by the time children's effects
fire).

## FAIL 2 — Long chapter titles wreck row alignment at 390px

**File:** `src/styles.css` (`.chapter-row` grid), see also design spec's own
requirement: "Long titles wrap; the row grid keeps checkbox/count/bar
alignment."

**Reproduction:**
1. Resize to 390×844.
2. Open Statute chapter, search "276" to isolate the row (c. 276 carries
   the longest title in the dataset: "Search Warrants, Rewards, Fugitives
   From Justice, Arrest, Examination, Commitment and Bail. Probation
   Officers and Board of Probation").

Screenshot: `round1-04-390px-c276-wrap.png`.

Result: the row's computed `grid-template-columns` is `98px 60px 84px
26px` — unchanged from desktop. The 98px first column holds *both* the
checkbox and the text block, so the actual text column is only **70px**
wide (measured via `getBoundingClientRect`). At that width the 129-character
title wraps to something close to one word per line, growing the row to
**241px tall** for a single entry. The count (722), share bar, and link
icon stay pinned to the top of that 241px-tall row in their own
fixed-width columns, so there's a large dead zone of empty space beside
the wrapped title and the share bar visually detaches from its row (it
ends up floating mid-height, disconnected from the count/link above it).
No horizontal scroll occurs (`chapter-rows-wrap.scrollWidth ===
clientWidth`, 322px both), so the *specific* failure mode the design spec
called out ("keeps ... alignment") is what breaks, not overflow.

**Suggested fix:** at narrow widths, either let the text column take the
row's full width and drop count/bar/link to a second line under it, or
cap/hide the share bar below some breakpoint and right-size the fixed
columns so the text column gets meaningfully more than 70px. A `grid-template-areas`
swap behind a max-width media query would do it without touching the
desktop layout.

## FAIL 3 — First Escape in the chapter search field doesn't close the modal

**File:** `src/ui/ChapterFilterModal.tsx` (search `<input type="search">`)
interacting with `src/ui/Modal.tsx`'s native `onCancel` handling.

**Reproduction (confirmed with real keyboard events, not scripted clicks):**
1. Open Statute chapter.
2. Click into the search field, type any character (real keypresses).
3. Press Escape once.

Result: the search field's value clears (`""`) but
`document.querySelectorAll('dialog[open]').length` is still `1` — the
modal stays open. A **second** Escape press is required to actually close
it (confirmed: it then closes and focus correctly returns to the
"Statute chapter" entry button).

**Root cause:** this is the browser's native `input[type="search"]`
behavior — Escape on a non-empty search field clears it first, and (in
this app's case) that consumes the keydown before the `<dialog>`'s own
native Escape-to-cancel fires. Confirmed the bug is scoped exactly to
"search field has focus": if focus is moved off the search field (e.g. via
Tab to a row checkbox) after typing, a single Escape closes the dialog
normally even with the query still populated.

**Impact:** breaks the "Escape always closes" mental model the DTP modal
(no search field) and the task's own test script assume ("Escape; focus
returns to the entry button on close"). A keyboard user who searches then
hits Escape, expecting to dismiss the modal, instead silently gets their
search cleared and has to notice the modal is still open.

**Suggested fix:** give the search `<input>` its own `onKeyDown` that
checks for Escape and calls the modal's `onClose` directly (bypassing the
native clear-on-escape default), or `preventDefault` isn't even needed —
just call `onClose()` unconditionally on Escape in that handler regardless
of what the native default does to the field's value.

---

## CONCERN — Native `<dialog>` doesn't wrap Tab from Apply back to Close in one step

**Reproduction:** open either modal, Tab all the way to Apply (last
focusable element), Tab once more.

Result: `document.activeElement` becomes `<body>` for one frame; a
*second* Tab is needed to land back on Close. This is standard Chromium
behavior for native `<dialog>` — the UA makes the background inert
(confirmed real background clicks are blocked: see "ruled out" section)
but doesn't itself implement a full circular focus trap, so focus that
runs off the end of the in-dialog tab sequence resets to `<body>` rather
than wrapping. This is **not new to this branch** — it's inherent to
`Modal.tsx`'s `showModal()`-based approach and would affect the DTP modal
identically. Flagging because the task asked specifically to verify
tab-wrap, and because a screen-reader user who tabs past Apply gets a
moment of "nowhere" before the next Tab recovers. Not a regression, low
priority, but worth a shared fix in `Modal.tsx` (a `keydown` handler that
explicitly wraps Tab/Shift+Tab at the first/last focusable element) if it's
ever addressed, since it would fix all three modals at once.

---

## Detail on PASS items worth noting

**Test 1 (keyboard-only), Severity modal:** full tab walk confirmed —
Close → header links (Master Crime List, G.L. c. 274 §1) → 4 cards, each
checkbox then its own More `<summary>` (no per-card links; only the header
carries links) → Clear → Cancel → Apply → wraps (via the body-then-Close
quirk noted above). Escape closes on the first press every time (no
search field in this modal) and returns focus to the "Severity" entry
button, both confirmed via `document.activeElement` after a real
`Escape` keypress with no scripted shortcuts involved.

**Test 1, Chapter modal tab order:** Close → search input → row 1
checkbox → row 1 link (`c. 90 on malegislature.gov`) → row 2... → last
row ("No statute code," pinned, no link — confirmed it has no `<a>`, just
an `aria-hidden` empty-link placeholder span) → Clear → Cancel → Apply.
Verified via `querySelectorAll('a[href], button, input, [tabindex]')`
scoped to the open dialog (144 focusable nodes) that nothing outside the
dialog is reachable, cross-checked against 71 rows × (checkbox + optional
link) + search + 3 footer buttons + Close.

**Test 2, 390px:** filter panel becomes a full-width fixed drawer with a
scrim; both modals render inside it usably; entry-button two-line
summaries wrap correctly (`c. 90 + 2 more` on its own line under a
blue-accented "Statute chapter •" label — `round1-05-390px-3chapters-summary.png`).
Chips row for 3 chapters + 1 severity wraps onto multiple lines with no
clipping or overlap (`round1-06-390px-chips-severity-chapters.png`).

**Test 3, dark/light:** toggled via the app's own theme control (not just
OS emulation). Coverage banner, chips, and both modals legible and
correctly token-driven in both themes
(`round1-07-coverage-banner-dark.png`, `round1-08-coverage-banner-light.png`,
`round1-09-severity-modal-light-history-on.png`). See "ruled out" section
below for a rendering false alarm during this pass.

**Test 4, share bars:** `.dtp-bar` (severity, 5/5 present) and
`.chapter-row-bar` (chapter, 71/71 present) are all `aria-hidden="true"`;
every `.dtp-card-count` / `.chapter-row-count` carries `aria-label="{n}
charges"` (e.g. `aria-label="526921 charges"`), so a screen reader gets
the number even though the visual bar is hidden from the tree.

**Test 5, chapter search:** empty query search for `zzz-nonexistent` shows
`No chapter matches "zzz-nonexistent".` (exact copy from
`chapterModel`'s row-list empty state); searching `"No statute"` returns
exactly one row (`No statute code`); clearing the field (via a real
`fill('')`, see the methodology note below about why a raw DOM mutation
gave a false failure here) restores all 125 rows (71 with history off,
125 once the pre-2022 dataset is loaded, since more chapters appear across
the full date range) with "No statute code" still pinned last.

**Test 6, severity history toggle:** with history off, the fifth card is
absent and the footnote reads *"The 2006-2021 dataset is not graded for
severity; turn on 'Include 2006-2021' to see it listed here."* With
history on, the footnote disappears and a fifth card, "Not graded
(pre-2022)," appears with a live count (526,921 in the state tested) and
its own share bar and More disclosure — confirmed in
`round1-09-severity-modal-light-history-on.png`.

**Test 8, links:** Master Crime List → `https://www.mass.gov/doc/master-crime-list`;
G.L. c. 274 § 1 → `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=274`;
every linked chapter row follows the same `?ChapterGoTo=<token>` pattern
(spot-checked c. 90, 265, 266, 94C, 6, 21A, 234, etc.); **c. 258 and c.
279C rows carry no link icon**, confirmed by absence of any `<a>` in
those `<li>`s (just an `aria-hidden` empty placeholder span) — matches
`MISCODED_TOKENS` in `chapterModel.ts`. c. 269C (also in that set) simply
doesn't occur as a value in the currently loaded dataset, so it never
renders a row either way. All 121 chapter-row links and the 2 header links
carry the external-glyph `<svg>` (`IconExternal`).

**Test 9, scroll lock/scrim:** `document.body.style.overflow === 'hidden'`
while any modal is open; `getComputedStyle(dialog, '::backdrop')` resolves
to `rgba(11, 11, 11, 0.45)`, `position: fixed`, `inset: 0` — full-viewport
scrim, confirmed distinct from the app's own dark-mode page background.

**Test 10, invented attacks (3 run):**
1. *Clear-then-Cancel staging attack* (the DTP v1 regression class from
   the spec's own review history): opened Chapter with 3 chapters
   selected, clicked Clear (all unchecked in the DOM), then Cancel.
   Chips/URL/entry-summary still showed all 3 original chapters
   afterward, and reopening the modal showed all 3 correctly re-checked —
   Cancel fully discarded the staged Clear. PASS.
2. *Exact-value chip removal + resync*: with chapters `[c. 90, c. 265, c.
   266]` applied, clicked the "Statute chapter: c. 265 ×" chip
   specifically. URL/chips/entry-summary updated to exactly `[c. 90, c.
   266]` (`c. 90 + c. 266`), and reopening the modal showed exactly those
   two checked, nothing else. PASS.
3. *Pathological search input*: typed `c. (94[C]*.+?^$|\d{3})` (regex
   metacharacters) into the chapter search. Filtering is plain
   `.includes()`, not a regex — correctly zero-matched with the literal
   string escaped in the empty-state message, no crash, no console
   errors. PASS.

---

## Investigated and ruled out (not real bugs — recorded so they aren't re-flagged)

**Two `<dialog>` elements open simultaneously.** While probing the Escape
bug above, I opened Chapter, left it open (via the Escape-doesn't-close
state), then used a scripted `element.click()` on the DTP entry button
sitting behind it — and it opened, leaving two `dialog[open]` elements at
once. This looked alarming, but a **real** mouse click on that same
button while the chapter modal is open times out / fails with `<dialog
open... > intercepts pointer events` (verified with an actual
`browser_click`, not a script). `element.click()` invoked from JS bypasses
hit-testing and inert enforcement in a way a real user's mouse or keyboard
cannot. Not reachable by a real user; not reported as a finding.

**Chapter modal appears to render light-themed despite dark mode.**
During the dark-mode pass, several **full-page** screenshots
(`round1-12` through `round1-16` in the screenshots folder) showed the
Statute chapter modal with a white/light card while the rest of the page
and the Severity modal (same session, same toggle) rendered correctly
dark. Chased this all the way down: `getComputedStyle` on the dialog and
every descendant (`h2`, lede `<p>`, search input, Cancel button,
`.chapter-rows-wrap`) unanimously reported correct dark values
(`color-scheme: dark`, dark backgrounds, white/light text) at every step,
including a clean page reload with a real click and no prior page state.
The tell: an **element-targeted** screenshot of the same open dialog
(`round1-18-chapter-dialog-element-only.png`, `locator.screenshot()`
instead of `page.screenshot()`) renders it correctly dark. This is a
Playwright/Chromium full-page-screenshot compositing quirk specific to
native `<dialog>` top-layer elements, not a CSS bug in the app. Confirmed
not a real bug; not reported as a finding. (Worth knowing for future
reviews of this app: if a modal looks wrong-themed in a full-page
screenshot, cross-check with an element-targeted screenshot before
reporting it.)

**My own search-field-clearing test method.** Early in the 390px pass I
cleared the chapter search box by setting `input.value = ''` and
dispatching a synthetic `input` event via `page.evaluate`. This desynced
React's internal `query` state from the DOM (the list stayed filtered to
1 row while the visible field showed empty) — a testing artifact, not an
app bug. Confirmed by redoing the same clear with a real
`locator.fill('')`, which worked correctly and restored all 71/125 rows
with the pin intact. Documented so the desync isn't mistaken for a
product defect if this transcript is read later.

---

## Copy tone vs. the DTP modal

Opened "Decline-to-prosecute categories" for comparison
(`round1-11-dtp-modal-comparison.png`). Both new modals read like the same
product: source-first lede paragraphs naming the exact document ("the
2019 ... published a list" / "the Massachusetts Sentencing Commission's
... Master Crime List, February 2026 edition"), one plain descriptive
sentence per card/row with no adjectives doing evaluative work, load-bearing
facts in a numeric chip rather than prose, an expandable "More" for the
caveat-level detail, and an identical Clear / Cancel / Apply footer. The
Severity modal's Unclassified card ("Charges the grading declined to
guess," with the three-family breakdown in More) matches the DTP modal's
own habit of naming exactly what a catch-all bucket holds rather than
gesturing at it. No register mismatch found.
