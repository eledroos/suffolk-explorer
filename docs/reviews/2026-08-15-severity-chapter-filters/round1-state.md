# Severity / Statute chapter filter modal state-machine testing — round 1

Branch: `severity-chapter-filters`
Dev server: http://localhost:5173
Tool: Playwright MCP
Date: 2026-08-15

**Result: 16/16 attacks PASS. Zero failures. Zero console errors/warnings across the whole session.**

## Setup notes

- Filters panel was already expanded on load. Base state hash is `#e30` (empty filter set), row count 161,134 of 200,630 (Filings lens, 2022-2025 only).
- Severity modal (`src/ui/Modal.tsx`-backed native `<dialog>`): checkboxes for
  `Felony` (46,568), `Misdemeanor` (94,918), `Civil infraction` (17,553),
  `Unclassified` (2,095), plus a fifth `Not graded (pre-2022)` row that only
  appears once the history dataset is toggled on. Footer: `Clear` / `Cancel` /
  `Apply`.
- Statute chapter modal: search box + 71 checkbox rows, all rendered in the DOM
  at once (no virtualization). Same footer pattern.
- Court filter (used for the URL round-trip test) is a different UI pattern:
  an inline expandable list in the sidebar that applies live, no stage/Apply
  step. Not one of the two modals under test but useful as a third filter for
  round-trip verification.
- `Modal.tsx` source (read directly): native `<dialog>` via `showModal()`,
  `onCancel` (Esc) calls `onClose()`, and `onMouseDown` checks
  `e.target === ref.current` (i.e. a click that lands on `::backdrop`, which
  registers on the dialog element itself) and also calls `onClose()`. Same
  component backs both modals, so Escape/backdrop behavior is shared code, not
  independently reimplemented per modal.

## Methodology note

Two techniques were used for speed: (1) real Playwright `browser_click`/
`browser_press_key` for anything testing actual user reachability (backdrop
clicks, inertness, Escape), and (2) direct DOM `.click()` via
`browser_evaluate` for routine staging clicks once the relevant code path was
independently confirmed safe. The DOM `.click()` shortcut bypasses real
hit-testing and would silently "succeed" against an element that a real user
could not reach (this happened once, see Attack 10 note below), so every
adversarial claim about inertness or dismissal (Attacks 10, 12, 15) was
verified with genuine Playwright clicks/keypresses or `elementFromPoint`-based
hit-testing before being called a PASS.

---

## Attack log

### Attack 1 — Stage two, Cancel, reopen must show empty (matches applied=empty)
Staged Felony + Misdemeanor in Severity modal, clicked Cancel. Hash stayed
`#e30`. Reopened: both checkboxes unchecked.
**PASS.**

### Attack 2 — Stage, Apply, reopen equals applied; uncheck one, Cancel, reopen still applied set
Applied Felony+Misdemeanor (hash became
`#eyJmaWx0ZXJzIjp7InNldmVyaXR5X2NsYXNzIjpbIkZlbG9ueSIsIk1pc2RlbWVhbm9yIl19fQ`,
decodes to `{"filters":{"severity_class":["Felony","Misdemeanor"]}}`). Row
count dropped 161,134 → 141,486. Reopened: both checked. Unchecked
Misdemeanor, clicked Cancel (hash unchanged). Reopened again: Felony AND
Misdemeanor both still checked.
**PASS.**

### Attack 3 — Clear inside modal with an applied filter, then Cancel: filter must survive
With Felony+Misdemeanor applied, opened modal, clicked Clear (both boxes went
unchecked in staging, hash unchanged), then clicked Cancel. Active row still
showed both chips (`Severity: Felony`, `Severity: Misdemeanor`), entry summary
still read "Felony + Misdemeanor", hash unchanged.
**PASS.**

### Attack 4 — Clear then Apply: filter fully removed
Reopened, clicked Clear, clicked Apply. Hash returned to `#e30`. Entry text
"Severity: any", chip count 0, row count back to 161,134.
**PASS.**

### Attack 5 — Select all Severity values, Apply: collapses to no filter
Checked all 4 rows (Felony, Misdemeanor, Civil infraction, Unclassified),
clicked Apply. Hash stayed `#e30` (did not encode a 4-value list). Entry "any",
0 chips, row count 161,134.
**PASS.**

### Attack 6 — Select all Statute chapter values (71 rows), Apply: collapses to no filter
All 71 chapter checkboxes exist in the DOM unvirtualized (task description
guessed ~69; actual count is 71, including "No statute code"). Checked all 71
via one batch click, clicked Apply. Hash stayed `#e30`, entry "any", 0 chips,
row count 161,134.
**PASS.** No accommodation needed for a "smaller trick" — full selection was
directly exercisable.

### Attack 7 — URL round-trip: severity=Felony + chapter=c.265 + court=Boston Municipal Court
Applied all three (two staged modals + one live inline filter). Resulting
hash:
`#eyJmaWx0ZXJzIjp7InNldmVyaXR5X2NsYXNzIjpbIkZlbG9ueSJdLCJzdGF0dXRlX2NoYXB0ZXIiOlsiYy4gMjY1Il0sImNvdXJ0IjpbIkJvc3RvbiBNdW5pY2lwYWwgQ291cnQiXX19`
= `{"filters":{"severity_class":["Felony"],"statute_chapter":["c. 265"],"court":["Boston Municipal Court"]}}`.
Row count 3,029 of 200,630. Opened a **new tab** with that exact hash. New
tab rendered: identical 3 chips (`Severity: Felony`, `Statute chapter: c. 265`,
`Court: Boston Municipal Court`), identical entry summaries, identical row
count (3,029), and the hash **byte-identical** to the original after load.
**PASS.**

### Attack 8 — Chip removal follows through to entry summary and modal staging
From the Attack 7 state, clicked the `Severity: Felony` chip's own remove
control. Hash updated to drop `severity_class`
(`#eyJmaWx0ZXJzIjp7InN0YXR1dGVfY2hhcHRlciI6WyJjLiAyNjUiXSwiY291cnQiOlsiQm9zdG9uIE11bmljaXBhbCBDb3VydCJdfX0`).
Entry summary reverted to "Severity: any", chip count 0. Reopened Severity
modal: all four boxes unchecked (matches new applied state = empty). As a
side effect this also incidentally confirmed cross-filter count
recomputation: with only chapter=c.265 + court=Boston Municipal active, the
modal's own Felony/Misdemeanor counts read 0 vs 0 unchecked but showed live
totals (Felony 3,029/Misdemeanor 3,760) matching the other two active
filters, foreshadowing Attack 9.
**PASS.**

### Attack 9 — Two modals in sequence, cross-filter counts, own selection preserved
Reset filters. Applied severity=Felony alone (hash
`#eyJmaWx0ZXJzIjp7InNldmVyaXR5X2NsYXNzIjpbIkZlbG9ueSJdfQ`). Opened the Chapter
modal: counts re-sorted and shrank to reflect the Felony filter — c.265 dropped
37,267 → 19,486, c.266 23,670 → 9,708, c.94C 15,715 → 7,495, c.269 12,088 →
5,588, c.268 4,207 → 1,272 (and c.90, previously the #1 row at 44,041, fell out
of the top 6 because most Motor Vehicles charges are misdemeanors). Selected
c.265, applied (hash added `statute_chapter:["c. 265"]`). Reopened Severity
modal: Felony still checked (own selection intact) AND its counts now reflect
the chapter filter (Felony 19,486, Misdemeanor 17,781, Civil infraction 0,
Unclassified 0 — all recomputed against chapter=c.265 rows only).
**PASS**, both directions of cross-filter propagation confirmed.

### Attack 10 — History toggle mid-stage
First tried the literal instruction: opened Severity modal, staged Felony
(unapplied), attempted a **real** Playwright click on the sidebar's
"Include the 2006 to 2021 history dataset" checkbox while the modal was open.
This **timed out after 5s** with Playwright reporting
`<dialog open aria-label="Severity" class="modal modal-wide"> intercepts
pointer events` — confirms the modal is a genuine native-`<dialog>` top-layer
modal that makes the rest of the page truly inert to real clicks, not just
visually dimmed. This is correct, intended behavior per the `Modal.tsx`
source, not a bug.

Per the attack's own fallback instruction ("if the modal blocks sidebar
access entirely, note that and instead: apply Felony, toggle history on, open
modal"): Cancelled the modal, applied severity=Felony normally, then toggled
history on with a real click (succeeds now that the modal is closed). Result:
- Row count header switched to the merged dataset total (1,293,519 total vs.
  200,630) and filtered count became 46,568 (exactly the Felony total in the
  2022-2025 dataset, since pre-2022 isn't graded).
- A "Severity filter excludes 2006-2021" coverage notice appeared automatically
  (this is also the Attack 11 precondition — see below).
- Reopened Severity modal: Felony still checked (staged/applied state survived
  the dataset swap), and a new 5th row appeared, "Not graded (pre-2022)" with
  874,107 charges.
**PASS**, with the adversarial finding above recorded as a confirmed-good
behavior, not a defect.

### Attack 11 — Coverage notice appears/disappears with "Not graded" selection
Continuing directly from Attack 10's end state (history on, severity=Felony
active, notice showing). Checked "Not graded (pre-2022)" in the still-open
Severity modal and clicked Apply. Hash became
`#eyJmaWx0ZXJzIjp7InNldmVyaXR5X2NsYXNzIjpbIkZlbG9ueSIsIk5vdCBncmFkZWQgKHByZS0yMDIyKSJdfSwiaGlzdG9yeSI6dHJ1ZX0`.
The "Severity filter excludes 2006-2021" notice was gone from the DOM. Row
count became 920,675 (46,568 Felony + 874,107 Not graded, arithmetic checks
out).
**PASS.**

### Attack 12 — Escape and backdrop click on each modal must behave as Cancel
Reset filters (kept history:true from Attack 10/11).

**Severity, Escape:** staged Felony, pressed real `Escape` key. Dialog closed
(`dialog[open]` → null), chip count 0, hash unchanged from before staging.
Reopened: unchecked, confirming discard.

**Severity, backdrop click:** staged Felony again. Used
`document.elementFromPoint(100, 100)` (a point well outside the dialog's
visible panel, which measured x:480-1134 / y:54-853 in a 1614x912 viewport) to
confirm the *actual* top-most hit-tested element at that point really is the
`<dialog>` node (i.e. genuinely testing backdrop hit-testing, not bypassing
layout). Dispatched a real `mousedown` event at that element/point (the
`Modal.tsx` handler is on `onMouseDown`, not `onClick` — confirmed by reading
source). Modal closed, staged Felony discarded, hash unchanged. (One
transient false read: checking `dialog[open]` synchronously inside the *same*
`evaluate()` call as the dispatch showed still-open, because React's
re-render from the state update hadn't flushed yet within that microtask; a
follow-up call a moment later showed it closed correctly. Noted here so the
methodology is auditable, not reported as a bug.)

**Statute chapter, Escape:** staged c.265, pressed Escape. Closed, chip count
0, hash unchanged.

**Statute chapter, backdrop click:** staged c.265, dispatched a real
`mousedown` at the hit-tested backdrop point. Closed, chip count 0, hash
unchanged.
**PASS**, all four (2 modals x 2 dismissal methods).

### Attack 13 — Rapid double-Apply / double-open
Triple-clicked the Severity entry button while a modal was already open:
`document.querySelectorAll('dialog[open]').length` stayed at 1 — no duplicate
dialogs. Staged Felony, triple-clicked Apply: hash shows exactly one clean
application (`severity_class:["Felony"]`, plus the already-on `history:true`),
no malformed/duplicated state. After the burst: `dialogCount` 0, `chips`
exactly `["Severity: Felony"]` (singular, not duplicated), `document.body.style.overflow`
back to `""` (not stuck at `hidden`, confirming the scroll-lock class from
`Modal.tsx`'s effect was cleaned up on unmount).
**PASS.** No console errors accumulated (checked after this and at end of
session: 0 errors, 0 warnings across the whole run).

### Attack 14 (custom) — Search text + selection independence, both reset on Cancel
In the Statute chapter modal: typed "265" into the search box (filtered list
to 1 row), checked it. Changed search text to "94C" (list re-filtered, c.265
now hidden from view), checked c.94C. Cleared search text entirely: **both**
c.265 and c.94C still showed checked, confirming staged selection is not
scoped to what the search currently shows. Set search text to garbage
("zzz-leftover-search-text"), clicked Cancel. Reopened: search box was empty
(`""`) and 0 rows checked — confirms both pieces of the modal's transient
state (search string and staged selection) reset together on Cancel, not just
the selection.
**PASS.**

### Attack 15 (custom) — Background filter entries are genuinely inert, not just the sidebar
Opened Severity modal (nothing staged this time). Attempted a real Playwright
click on the Statute chapter entry button in the background filter panel.
Timed out after 5s with the same `<dialog> intercepts pointer events` message
seen in Attack 10. Confirms the native-dialog inertness covers the entire
rest of the page (all filter entries, not only the history toggle tested
earlier) — a real user genuinely cannot open a second modal or interact with
any other filter control while one is open.
**PASS.**

### Attack 16 (custom) — Malformed/unknown filter values in a hand-crafted URL hash
Built a hash encoding
`{"filters":{"severity_class":["Bogus Value That Does Not Exist"],"statute_chapter":["c. 999-nonexistent"]}}`
and navigated directly to it (simulating a stale/hand-edited/corrupted link).
- No crash, no console errors or warnings (checked before and after).
- Header showed "0 of 200,630 charge rows" (correct: nothing matches
  nonexistent values).
- Active row rendered both chips with the literal garbage text, CSS-truncated
  with an ellipsis rather than breaking layout.
- Opened the Severity modal: it rendered normally (14 checkboxes present, 0
  checked) rather than crashing or throwing on the unrecognized value — the
  unknown staged value is simply not reflected in any real checkbox, since
  none matches it.
**PASS** (graceful degradation). Soft observation, not a failure: an unknown
value in the URL has no way to be cleared from inside the modal itself (since
no checkbox represents it) short of the "Clear" button or "Clear all", which
do work. This is a reasonable, low-severity UX edge case rather than a state
bug, since it requires a hand-crafted or corrupted URL to reach.

---

## Summary

**16 attacks run, 16 passed, 0 failed.**

No state leaks, no stale staging, no URL desync, no duplicate dialogs, no
stuck scrim, and no console errors were found anywhere in this session. The
Severity and Statute chapter modals share one `Modal.tsx` component
(confirmed by reading the source directly) that implements Cancel, Escape,
and backdrop-dismiss consistently and correctly via native `<dialog>`
semantics, and both modals' "select everything visible" case collapses
correctly to "no filter" rather than encoding a redundant full-value list in
the URL. Cross-filter count propagation (Attack 9) and the pre-2022
severity-coverage notice (Attacks 10-11) both behaved correctly on the first
real try.

The one genuine methodological trap encountered: synthetic `element.click()`
via `browser_evaluate` bypasses real hit-testing/inertness, so an early,
naive version of Attack 10 (toggling history while the modal was "open")
falsely appeared to succeed. Every claim in this log about dismissal or
inertness (Attacks 10, 12, 15) was re-verified with genuine Playwright
mouse/keyboard input or `elementFromPoint`-based hit-testing before being
recorded as a PASS.

No FAILs to reproduce.
