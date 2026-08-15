# Round 2 adversarial re-verification — severity-chapter-filters, HEAD 7ceda50

Repo: /Users/nasser/_dev/nasser-blog-posts/2026-08-03 Suffolk DA/data/suffolk-explorer
Dev server: http://localhost:5173 (was already up, confirmed 200 before starting)
Method: Playwright MCP against the live dev server. Actions and state checks were
kept in separate tool calls throughout, after an early false alarm showed that
checking `document.querySelector('dialog[open]')` synchronously in the same
`evaluate()` call as a raw `.click()` reads stale DOM from before React flushes
the state update — not a real bug, just a test-harness timing artifact once
diagnosed (see "Methodology note" below).

**Attacks run: 15 (7 scripted + explicit strengthening variants + 2 new).
Passed: 15. Failed: 0.**

## Methodology note (logged because it cost real time)

Two apparent "failures" during setup turned out to be testing mistakes, not
app bugs:

1. **Synchronous post-click DOM check.** `page.evaluate(() => { btn.click();
   return document.querySelector('dialog[open]') })` returns the pre-render
   DOM because React's state update hasn't flushed inside that same
   synchronous function. Splitting the click and the check into two separate
   `evaluate()` calls (or using the `browser_click` tool, which yields to the
   event loop) gives the true post-render state. Any future round should
   never trust a state check made in the same synchronous callback as the
   action that changed the state.

2. **Ambiguous "Statute chapter" text selector.** Once a chapter filter is
   applied, two elements match `button:has-text("Statute chapter")`: the
   `.entry-btn` that opens the modal, and the `.chip` "Remove Statute
   chapter: c. 90" button in the Active-filters section. A `.find()` over
   `querySelectorAll('button')` picks whichever is first in DOM order (the
   chip, since the Active section renders before the Case section) —
   clicking it silently cleared the filter instead of reopening the modal,
   producing a URL that reverted to the default hash. This looked exactly
   like a state-reset bug until the real target was found. Fixed by scoping
   every subsequent selector to `.entry-btn:has-text(...)`.

Both are recorded here so the next round doesn't waste time rediscovering
them, and so this pass's PASS verdicts aren't dismissed as "the agent didn't
actually test the failure mode" — they were tested, twice, deliberately with
disambiguated selectors and split action/check calls.

## Attacks

**1. Chapter modal, desktop width (1400px): stage 2, Escape from search.**
PASS. Base case (nothing applied yet): staged c. 90 + c. 265, clicked into
the search field, pressed Escape → dialog closed, `checked` count 0 on
reopen, no other UI affected.
Strengthened: applied c. 90 first (Apply → hash
`#eyJmaWx0ZXJzIjp7InN0YXR1dGVfY2hhcHRlciI6WyJjLiA5MCJdfX0`), reopened,
staged c. 265 in addition to the already-checked c. 90, focused the search
input, pressed Escape → dialog closed, hash unchanged (still just c. 90),
entry button read "Statute chapterc. 90". Confirms discard reverts to the
*actual applied state*, not to empty.

**2. Chapter modal at 390px with the drawer open: Escape semantics.** PASS.
Resized to 390×844 with `.fpanel` open. Opened the chapter modal (search
auto-focused, confirmed via `document.activeElement.className ===
'chapter-search'`). Pressed Escape once → `dialog[open]` gone, `.fpanel`
still present (drawer intact). Pressed Escape again → `.fpanel` gone
(drawer closed). This is the direct test of the `stopPropagation` fix in
commit 7ceda50: the first Escape must not reach FilterPanel's window-level
listener in the same event.

**3. Escape from a row checkbox (not search).** PASS. At desktop width with
c. 90 applied, reopened the modal, clicked the c. 265 checkbox (confirmed
`document.activeElement` was the checkbox, not the search input), pressed
Escape → dialog closed via the native `<dialog>` cancel path (no
`stopPropagation` involved here, since the search field's own keydown
handler never fires), staged c. 265 discarded, hash unchanged (still just
c. 90).

**4. Severity modal — full stage/cancel/apply/clear/full-selection matrix.**
PASS on all five sub-cases:
   - Stage Felony, Cancel, reopen → 0 checked (discarded).
   - Stage Felony + Misdemeanor, Apply, reopen → both checked (persisted;
     hash gained `severity_class:["Felony","Misdemeanor"]`).
   - Clear (while Felony+Misdemeanor showing), confirmed 0 checked, Apply →
     hash reverted to just the chapter filter (severity_class key removed
     entirely, not set to `[]`).
   - Checked all 4 visible cards (Felony, Misdemeanor, Civil infraction,
     Unclassified), Apply → hash byte-identical to the pre-open hash (no
     `severity_class` key added), confirming full-selection collapses to
     "no filter" per `normalizeSeverity`.

**5. URL round-trip.** PASS. Applied severity=Misdemeanor + chapter=c. 90
(hash
`#eyJmaWx0ZXJzIjp7InN0YXR1dGVfY2hhcHRlciI6WyJjLiA5MCJdLCJzZXZlcml0eV9jbGFzcyI6WyJNaXNkZW1lYW5vciJdfX0`).
Opened that exact string in a new tab. `location.hash === original` → true
(byte-equal). Active-filter chips in the new tab read "Statute chapter: c.
90" and "Severity: Misdemeanor" — confirms decode, not just string
identity.

**6. Cross-modal counts.** PASS. Applied severity=Civil infraction alone,
opened the chapter modal: c. 90 (Motor Vehicles and Aircraft) = 12,535,
the largest bar by a wide margin (next is c. 89, Law of the Road, at
4,156); c. 265 (Crimes Against the Person) = 0, i.e. more than "nearly
vanishes" — it fully vanishes, which is the expected sanity result since
civil infractions are essentially all traffic-code chapters.

**7. Backdrop click on each modal.** PASS on both. Chapter modal: staged
c. 89 in addition to the applied severity filter, dispatched a `mousedown`
MouseEvent directly on the `dialog[open]` element (replicating the real
browser behavior where a native `::backdrop` click's `event.target` is the
`<dialog>` itself, which is exactly the condition the app's
`onMouseDown={(e) => { if (e.target === ref.current) onClose(); }}` checks)
→ dialog closed, staged chapter addition discarded. Severity modal: same
pattern, staged Felony in addition to applied Civil infraction, backdrop
mousedown → dialog closed, Felony discarded, hash still just
`severity_class:["Civil infraction"]`. Per the brief, focus landing on
`document.body` afterward was not treated as a failure (documented parked
issue).

**8. Two attacks on the new code paths.**

   - **8a — ephemeral search state must not survive a remount, staged
     filters must.** Opened the chapter modal, typed "motor" into search
     (filtered 71 rows → 4), clicked Cancel, reopened. Result: `query ===
     ''`, all 71 rows back, and `document.activeElement` was the search
     input again. This is a real test of the "new mount, `useState(() =>
     ...)`" pattern the focus-effect comment describes — confirms the
     `requestAnimationFrame` focus effect fires correctly on every fresh
     mount and that local UI state (the search string) does not leak
     between opens, unlike the staged-filter Set which correctly seeds
     from `view.filters` each time.
   - **8b — narrow-width two-row grid layout doesn't break hit targets for
     a long-title row.** At 390px, searched "276" to isolate c. 276 (the
     129-character title the CSS comment in commit f3c20f4 names
     explicitly). Measured `getBoundingClientRect()` for the checkbox,
     count, link, and title: first-row elements end around y=291, the
     title's second row starts at y=293 — no overlap. Clicked the
     checkbox: `checked` became `true`, the row gained class `on`, and the
     external link's `href` was still
     `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=276`
     (unaffected by the `display: contents` restructuring of
     `.chapter-row-label`/`.chapter-row-text`).

## Console errors

`browser_console_messages` at `error` level: 0 messages across the entire
session. (An earlier `all: true` dump surfaced unrelated noise — a stale
Vite HMR websocket failing against port 5174 and an iframe-resizer notice
from a `mass.gov` page — left over from a prior, unrelated browser-tab
history predating this session's first navigation. Not related to this
app or this round's changes.)

## Verdict

Close/staging semantics hold across both modals, at both widths, for all
three exit paths (Cancel, Escape-from-search, Escape-from-elsewhere,
backdrop click) and all persistence paths (Apply, Clear+Apply,
full-selection collapse, URL round-trip). The three commits since the last
clean 16-attack pass (chapter search autofocus, narrow-width row layout,
Escape-search stopPropagation) each got a direct, targeted attack (8a, 8b,
2) in addition to being exercised incidentally by the other six. No
regressions found.
