# Round 2 UX/accessibility pass — Severity + Statute chapter filter modals

Branch `severity-chapter-filters`, HEAD `fe87265` (`fe872657f50375e544faf2dd91a822f7c8a3d67d`,
"Misdemeanor blurb tracks the statutory definition exactly"). Dev server started fresh for this
pass (`npm run dev`, Vite 6.4.3, `http://localhost:5173`). Chrome/150 via Playwright MCP, single
browser session, `location.href` confirmed to start with `localhost:5173` before every test
sequence (verified repeatedly via `page.evaluate(() => location.href)` / snapshot URLs).

Prior round fixed: chapter search initial focus, 390px chapter-row wrapping, Escape-in-search
closing on first press. All three were re-verified here and still hold (see 1f, 2a, 3a below) —
no regression.

**Totals: 39 sub-checks run. 35 PASS. 3 distinct FAIL bugs (manifesting across 4 sub-checks). 1 CONCERN.**

---

## 1. Keyboard-only pass (both modals)

| # | Check | Verdict |
|---|---|---|
| 1a | Tab order is logical (Close → header links → card/row checkboxes → More/link buttons → Clear/Cancel/Apply) | PASS |
| 1b | Focus visible at every stop (`outline: solid 2px` computed at each stop) | PASS |
| 1c | Forward wrap: Tab from Apply (last focusable) returns to Close (first) | **FAIL — see below** |
| 1d | Backward wrap: Shift+Tab from Close (first focusable) returns to Apply (last) | **FAIL — see below** |
| 1e | Escape closes dialog from Close-button focus | PASS |
| 1f | Escape closes chapter search field on the **first** press (not clear-then-close) | PASS |
| 1g | Focus returns to the entry button that opened the modal, after Escape | PASS |
| 1h | Focus returns to the entry button after Close(×) / Cancel / Apply button clicks | PASS |
| 1i | Focus returns to the entry button after a **backdrop click** | **FAIL — see below** |
| 1j | Escape closes only the topmost modal, not the whole Filters drawer, at <1100px | **FAIL — see below** |

### FAIL: Tab focus-trap wrap fails on every alternate dialog open (Chromium)

Reproduction (both Severity and Chapter modals, same shared `Modal.tsx`):
1. Open the modal (e.g. click "Severity").
2. Tab to the last focusable element (Apply) and press Tab once more — **or** Shift+Tab once from
   the first focusable element (Close, or the chapter search box's *previous* sibling).
3. First open of the page: wraps correctly (Apply→Close, or Close→Apply).
4. Close and reopen the **same or a different** filter modal. Repeat step 2.
5. The wrap now fails: focus lands on `<body>` instead of the sibling end of the dialog.
6. This alternates deterministically — verified over 8 consecutive open/close cycles with both
   50ms and 400ms pacing between actions (ruling out a test-timing race): odd-numbered opens fail,
   even-numbered opens succeed, every time.
7. Reproduces identically on the Chapter modal (confirmed both directions, 4-6 iterations each).

Evidence (`browser_run_code_unsafe`, 8 iterations, Severity modal, Shift+Tab from Close):
```
iter0 -> Apply (OK)   iter1 -> BODY (FAIL)   iter2 -> Apply (OK)   iter3 -> BODY (FAIL)
iter4 -> Apply (OK)   iter5 -> BODY (FAIL)   iter6 -> Apply (OK)   iter7 -> BODY (FAIL)
```
Same alternation confirmed for forward-wrap (Tab from Apply) and on the Chapter modal.

Impact: a keyboard user who has used the app for more than one modal-open in the session has
roughly 50% odds that wrap-around Tab navigation drops them onto `<body>` — no visible focus ring,
disorienting, and the next Tab press re-enters the dialog at Close, silently skipping wherever they
"should" have landed. Root cause is not app code — `Modal.tsx` implements no manual focus trap at
all; it relies entirely on native `<dialog>.showModal()`. This looks like a Chromium engine quirk
in how the native modal's sequential-focus-navigation boundary is recomputed across repeated
open/close cycles of dialogs that fully unmount and remount (this app's `{open && <Modal/>}`
pattern creates a fresh `<dialog>` DOM node on every open). Because it is 100% reproducible and
alternates in lockstep with dialog-open count, it is not a one-off flake — it's a real thing a user
will hit. Worth a defensive fix: a small `keydown` handler in `Modal.tsx` that manually wraps Tab/
Shift+Tab when it detects focus about to leave the dialog would neutralize this regardless of
browser-engine behavior.

### FAIL: backdrop click loses focus to `<body>` instead of the opener

Reproduction:
1. Open Severity via a real mouse click on its entry button (opener correctly captured — confirmed
   `document.activeElement` = the entry button right after open).
2. Click far outside the dialog's bounding box (e.g. viewport corner (5,5), well outside the
   measured dialog rect).
3. Dialog closes (correct — `dialog[open]` becomes false, 0 `<dialog>` nodes left).
4. `document.activeElement` is `<body>`, not the entry button.

Contrast: Escape, Close(×), Cancel, and Apply **all** correctly restore focus to the entry button
(verified explicitly, 3/3). Only the backdrop-click path loses it, even though all four routes call
the exact same `onClose` prop and the exact same cleanup effect in `Modal.tsx`
(`if (opener && document.contains(opener)) opener.focus();`). The likely mechanism: the backdrop
`mousedown` target is the `<dialog>` element itself (not a focusable element), and Chromium's
default mousedown behavior blurs current focus to `<body>` as part of handling that same mousedown,
racing against the React `onMouseDown` handler's `onClose()` → unmount → `opener.focus()` chain.
Net effect for the user: dismissing a filter modal by clicking outside it (a very common dismissal
gesture) silently drops keyboard focus to the top of the document instead of leaving it on the
control they just used.

### FAIL: Escape closes the entire Filters drawer, not just the topmost modal, under 1100px

Reproduction (fresh page load each time, confirmed twice cleanly):
1. Resize to 390×844 (or any width <1100px).
2. Click "Filters" (opens the overlay drawer) → click "Statute chapter" (opens the modal on top).
3. Press Escape **once**.
4. Both `dialog[open]` and `.fpanel` (the drawer) are gone. `beforeEscape: {dialogOpen:true,
   drawerOpen:true}` → `afterOneEscape: {dialogOpen:false, drawerOpen:false}`.

`FilterPanel.tsx` clearly intends to prevent exactly this:
```js
const onKey = (e) => {
  if (e.key !== 'Escape') return;
  if (document.querySelector('dialog[open]')) return;   // <- guard meant to stop this
  if (window.matchMedia('(max-width: 1100px)').matches) onClose();
};
```
The guard checks whether a dialog is still open at the moment the drawer's own `keydown` listener
runs, but in practice it never sees `dialog[open]` — the modal's native `cancel`-driven close (and
synchronous unmount) appears to complete before the drawer's `window`-level `keydown` listener
fires, so the guard reads `false` and closes the drawer too. On mobile-width screens, a user who
opens "Statute chapter" from the drawer and hits Escape to back out of just that one filter is
instead kicked all the way out of Filters entirely — they have to reopen the drawer and re-find
their place.

---

## 2. Chapter search

| Check | Verdict |
|---|---|
| 2a | Search input receives focus when modal opens (`document.activeElement === .chapter-search`) | PASS |
| 2b | Typing filters immediately, no debounce (71 rows → 1 row on "265") | PASS |
| 2c | Zero-result state: `No chapter matches "…".` renders, 0 rows | PASS |
| 2d | Clearing the query restores all 71 rows (on a clean input, not one contaminated by a prior raw `.value=` script — see note) | PASS |
| 2e | "No statute code" is pinned last only when unfiltered; a matching search does not artificially re-pin it | PASS |

Note: one early attempt to "clear" the search field by setting `input.value = ''` directly via
`page.evaluate` (bypassing Playwright's `.fill()`) left the list stuck showing only the previously
filtered row, even after the DOM's visible value read back as `''`. Retesting on a fresh dialog
instance using only `locator.fill()`/keyboard input worked correctly every time. This was
self-inflicted test contamination (raw DOM mutation desyncing React's input-value tracker), not an
application bug — flagging it here only so nobody chases it as a repro.

---

## 3. 390px viewport

| Check | Verdict |
|---|---|
| 3a | c. 276 row (longest title, 129 chars): checkbox/value/count/bar/link stay on one stable first line, title wraps to a full-width second row | PASS (screenshot confirms exact match to the code comment's intent) |
| 3b | No horizontal scroll: `<html>` (`scrollWidth === clientWidth === 390` in every state checked: home, Severity modal open, Chapter modal open/filtered/cleared), `.chapter-rows-wrap` container, `.chapter-search` (even holding a 3000+ char string) | PASS |
| 3c | Entry summaries in the drawer wrap-capable (`white-space: normal; overflow-wrap: break-word` in CSS) and don't overflow with the longest realistic 2-value combination ("Civil infraction + Unclassified", 32 chars, 269px measured width inside a 390px viewport) | PASS |
| 3d | Active chips wrap onto their own lines/stack vertically at 390px rather than overflowing | PASS |

Screenshots taken: `390-home.png`, `390-severity-modal.png`, `390-chapter-276.png`,
`390-drawer-entry-summary.png` (all in the outer repo's `.playwright-mcp`-adjacent working dir,
since that's where this Playwright MCP session's relative screenshot paths resolved).

---

## 4. Dark mode

| Surface | Verdict |
|---|---|
| Severity modal (cards, checkboxes, bars, links, footnote) | PASS — legible, good contrast, screenshotted at 390px |
| Chapter modal (rows, checked-row highlight, bars, link icons) | PASS — legible, screenshotted at desktop width with a checked row |
| Active filter chips | PASS — legible dark chip with light text and visible × glyph |
| Severity/history coverage banner ("Severity filter excludes 2006-2021") | PASS — legible, same "Note" treatment as the existing "2025 filings run low" banner |

No invisible text found anywhere sampled. (Note on this surface's identity: "the severity/history
coverage banner" is `engine/coverage.ts`'s `severity-excludes-history` registry entry — a
banner-only, no-band notice that fires when `view.history === true` and an active severity
selection excludes `'Not graded (pre-2022)'`. It renders through the same generic "Note" callout as
data-coverage notices like "2025 filings run low," not a modal-specific element. Reproduced by
turning history on, filtering Severity to Felony only, and confirming the note text and dismiss
button.)

---

## 5. Share bars aria-hidden; counts exposed with labels

| Check | Verdict |
|---|---|
| Severity `.dtp-bar` elements: `aria-hidden="true"` on all 5 cards (incl. Not graded, history on) | PASS |
| Severity `.dtp-card-count` elements: `aria-label` present and correct ("46568 charges", "874107 charges", etc.) | PASS |
| Chapter `.chapter-row-bar` elements: `aria-hidden="true"` sampled across rows | PASS |
| Chapter `.chapter-row-count` elements: `aria-label` present and correct | PASS |

---

## 6. History off/on card and footnote behavior

| Check | Verdict |
|---|---|
| History off: `SEVERITY_FOOTNOTE_NO_HISTORY` paragraph present; "Not graded (pre-2022)" card absent from the list | PASS |
| History on: "Not graded (pre-2022)" card present with a live count (874,107 charges in the full unfiltered view), footnote paragraph gone | PASS |

---

## 7. Link icons

| Check | Verdict |
|---|---|
| Severity header: both links present (Master Crime List → mass.gov, G.L. c. 274 § 1 → malegislature.gov) with external-icon `<svg>` and correct `target="_blank" rel="noopener noreferrer"` | PASS |
| Chapter rows: exactly `c. 258`, `c. 279C`, and `No statute code` lack a link icon with history off (71 rows total) | PASS |
| Chapter rows with history on (125 rows): the same three plus `c. 269C` (which only exists in the pre-2022 data) lack a link icon — confirmed by searching "269" and seeing `c. 269` linked but `c. 269C` not | PASS |

---

## 8. Modal scroll lock, scrim, double-open protection

| Check | Verdict |
|---|---|
| `document.body.style.overflow === 'hidden'` while a modal is open | PASS |
| Double-open protection: dispatching two synchronous `click()`s at the entry button never produces more than one `<dialog>` node (React state is idempotent; `useState(false)` boolean per modal) | PASS |
| Clicking the backdrop closes the dialog | PASS (functionally — but see 1i above: the focus-restore on this path is broken) |

---

## 9. Copy tone versus the DTP modal — same product?

Largely yes, with one asymmetry worth a look.

**Consistent:** all three ledes (DTP's Rollins-memo framing, Severity's Master Crime List framing,
Chapter's statute-parsing framing) share the same register — plain declarative sentences, sources
named inline, no marketing adjectives, comfortable naming uncertainty in its own voice ("Rather than
guess, these rows are labeled Not graded" reads the same as DTP's "The worksheet itself contains the
conflict, and the tagging here preserves it"). Card blurbs match style across DTP and Severity
one-for-one (one plain sentence, then a "More" disclosure with denser detail). Button labels are
contextually appropriate, not inconsistent ("Clear both" on DTP because it stages two columns,
"Clear" on the single-column Severity/Chapter modals).

**CONCERN:** the Chapter modal is the one sibling with no per-item "More" disclosure at all — DTP
cards and Severity cards both offer expandable context/caveats per item; Chapter rows offer only a
value, a title, a count, and an outbound link. Its lede is also the thinnest of the three (two short
mechanical sentences vs. DTP's and Severity's scene-setting). This may well be intentional — a
70-entry chapter list genuinely has less of a story to tell per row than five hand-picked DTP/
severity categories, and the malegislature.gov link is Chapter's stand-in for "More" — but it does
mean Chapter reads like a lighter-weight sibling next to the other two Case-group modals. Worth a
product call on whether that's the intended feel or a gap.

---

## 10. Three invented attacks

| # | Attack | Verdict |
|---|---|---|
| A | Live window resize *while a modal is open* (1400px → 390px → back to 1400px, no close/reopen) | PASS — dialog stays open, visible, correctly repositioned at every width; no horizontal scroll introduced; no JS errors |
| B | Pathological/injection search query in chapter search: `<script>alert(1)</script>"'` + backtick + template-literal-lookalike + 50 unmatched parens + 50 backslashes + 3000 `x` chars | PASS — React escapes it correctly in the zero-result message (`&lt;script&gt;…`), no execution, no crash, no page-level horizontal scroll (the input scrolls its own overflow internally, which is normal/expected for a single-line text field), no console errors |
| C | Rapid Apply → immediate reopen (no wait) to check for stale `staged` state from the lazy `useState` initializer racing the parent's filter-state update | PASS — reopening immediately after Apply correctly shows the just-applied selection (Felony + Misdemeanor both checked), URL hash correctly reflects both values |

No new bugs found via these three; good evidence the app is robust to input edge cases and to
timing races that aren't specific to the native-dialog focus-trap issue in section 1.

---

## Summary

- **Checks run:** 39
- **Passed:** 35
- **Failed:** 3 distinct bugs (4 sub-checks: 1c/1d are the same bug in both directions)
- **Concerns:** 1

**FAIL 1 — Tab-wrap focus-trap escapes to `<body>` on every alternate dialog open**, both
directions, both modals. Reproduction: open a modal, close it, reopen it, Tab-wrap or Shift+Tab-wrap
once. Fails on every 2nd, 4th, 6th... open of the session; succeeds on 1st, 3rd, 5th. Verified with
both 50ms and 400ms pacing to rule out a test-timing artifact. Likely a Chromium native-`<dialog>`
engine quirk interacting with this app's unmount/remount-per-open pattern; `Modal.tsx` has no manual
focus-trap code to compensate.

**FAIL 2 — Backdrop-click dismissal loses focus to `<body>`** instead of returning it to the entry
button that opened the modal. Escape, Close(×), Cancel, and Apply all restore focus correctly;
clicking outside the dialog does not.

**FAIL 3 — A single Escape press closes both the topmost filter modal and the entire Filters
drawer** on viewports under 1100px, contradicting the explicit guard clause written in
`FilterPanel.tsx` to prevent exactly this. Reproducible cleanly on a fresh page load, both modals.

**CONCERN — Chapter modal's copy is a lighter-weight sibling** to DTP and Severity: no per-row
"More" disclosure and a thinner lede. Possibly intentional; worth a product confirmation.

Everything else in the assigned matrix — chapter search behavior, 390px layout including the c. 276
row, dark-mode legibility across both modals/chips/banner, aria-hidden bars and labeled counts,
history on/off card behavior, link-icon exclusions (including the history-gated c. 269C case),
scroll lock, and double-open protection — passed cleanly, including the three areas the prior round
fixed (chapter search initial focus, 390px row wrapping, Escape-in-search closing on first press),
which held up under this fresh pass with no regression.
