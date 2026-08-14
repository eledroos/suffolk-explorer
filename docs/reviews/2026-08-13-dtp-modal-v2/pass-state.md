# DTP filter modal v2 — adversarial review, state machine (abbreviated re-run of v1 pass 3)

Branch: `dtp-modal-v2`, HEAD `74b87e9`. Driven live against `npm run dev -- --port
5261` with Playwright MCP. Code read: `src/ui/DtpFilterModal.tsx`,
`src/ui/dtpModel.ts`, `src/ui/DtpBrowseTab.tsx`, `src/ui/Modal.tsx`,
`src/ui/FilterPanel.tsx`. Prior report read: v1's
`docs/reviews/2026-08-12-dtp-filter-modal/pass3-state.md`.

Mechanism confirmed unchanged from v1 before attacking: `staged` is a single
`useState(() => stageFromFilters(view.filters))` holding both `dtp_class` and
`dtp_review` Sets, re-derived fresh on every mount. `FilterPanel` still mounts
`DtpFilterModal` conditionally (`{dtpOpen && <DtpFilterModal .../>}`), so every
open is a fresh component instance; `tab` state (`useState<DtpTab>('class')`)
resets to `'class'` on every fresh mount. Cancel, backdrop click, and Esc all
route through `onClose` without calling `onSetFilter`; only `apply()` calls
`onSetFilter` once per `DTP_COLUMNS` entry (`for (const col of DTP_COLUMNS)
onSetFilter(col, payload[col])`), unconditional on which tab is active. The
new tab UI (`class` / `review` / `browse`) is a pure rendering layer over the
same staged object; the tabs do not carry independent state for `dtp_class`
vs `dtp_review`, so nothing about the staging/commit/discard contract needed
to change to support tabs, and testing confirms it didn't.

One new piece of state since v1: `browseConflicts` (whether Browse tab 3 is
currently deep-linked to the conflict filter), governed by a `useEffect` that
clears it whenever `tab !== 'browse'`.

## Per-attack results

| # | Attack | Result |
|---|--------|--------|
| 1 | Toggle three boxes, Cancel, reopen: staged = applied (none) | PASS |
| 2 | Check YY, Apply, reopen, uncheck, Cancel, reopen: YY still checked | PASS |
| 3 | Check all 5 dtp_class, Apply: normalizes away (no chip, "any", clean hash `#e30`) | PASS |
| 4 | Apply YY + Current list, copy URL, new tab: both present, modal staged right | PASS |
| 5 | Apply YY, remove chip in sidebar, reopen: nothing staged (that column only) | PASS |
| 8 | Clear both, Apply: gone (hash back to `#e30`) | PASS |
| 10 | Select all minus one, Apply: exactly 4 values | PASS |
| T1 | Stage 2 on tab 1, switch to tab 2, stage 1, switch to Browse, back to tab 1: all staged intact, badges correct throughout | PASS |
| T2 | Apply from tab 2 (Review status): writes both columns' staged state, closes | PASS |
| T3 | Caveat link -> Browse (conflicts filtered) -> Cancel (Esc): no filter written; reopen staged = applied; Browse's conflict filter resets to All on manual revisit | PASS |
| T4 | Esc on tab 3 (Browse) = Cancel semantics (staged discarded), drawer stays open, tested at 1000px | PASS |
| T5 | Reopen always lands tab 1 | PASS |

**12/12 PASS. Zero Critical or Important findings.**

## Detail on attacks worth narrating

**Attacks 1-10 (unchanged from v1).** Reproduced against the tabbed UI with
identical results to v1's pass 3, including matching hash values where
comparable (e.g. attack 4's YY+Current-list hash
`eyJmaWx0ZXJzIjp7ImR0cF9jbGFzcyI6WyJZWSAoZGVjbGluZSBsaXN0KSJdLCJkdHBfcmV2aWV3Ijpb...`
decodes to the same payload v1 recorded). This is the expected result given
the staging logic is untouched; it rules out a tab-switch regression breaking
any of v1's five originally-scoped attacks (1, 2, 3, 4, 5) or its invented
ones (8, 10 renumbered here from the caller's list).

**T1 (cross-tab staging persistence).** Checked "On the decline list" and
"Presumption against" on tab 1 (badge became "Decline list· 2"), switched to
Review status and checked "Not reviewed" (badge "Review status· 1"), switched
to Browse (badges stayed "· 2" / "· 1" while Browse showed no badge, as
expected since it has no `col`), then switched back to tab 1. Checkbox states
for tab 1 were still exactly `{On the decline list: true, Presumption
against: true, Case-by-case: false, Ordinarily prosecuted: false, Not listed:
false}` and both badges were unchanged. Confirms `staged` is genuinely
tab-independent, not reset or partially clobbered by `setTab`.

**T2 (Apply from a non-default tab).** With tab 1 holding a staged YY and tab
2 holding a staged Current-list check, clicking Apply while tab 2 (Review
status) was active produced hash
`{"dtp_class":["YY (decline list)"],"dtp_review":["Current list"]}` — both
columns written, matching the unconditional `for (const col of DTP_COLUMNS)`
loop in `apply()`. The Apply/Cancel action bar is conditionally rendered
(`tab !== 'browse'`) but is present and wired identically on both tab 1 and
tab 2, so there is no per-tab Apply path to diverge.

**T3 (caveat deep-link, Cancel, and conflict-filter reset).** From tab 1 with
4 of 5 dtp_class boxes checked, clicked "See the conflicting rows," landing on
Browse tab 3 with radio "Conflicts" checked (confirmed via `aria-checked`) and
the table pre-filtered to the ⚑-flagged rows. Pressed a real `Escape`
keypress. Three things verified in order: (a) `location.href` hash was
byte-identical before and after the Escape — no filter write occurred; (b)
reopening the modal showed the checkbox state and active tab (`class`,
autolanded per T5) exactly matching the previously-applied 4 values, i.e.
staged == applied; (c) manually clicking into the Browse tab from this fresh
mount showed radio "All" checked and "Conflicts" unchecked, confirming the
`useEffect` that clears `browseConflicts` when `tab !== 'browse'` did its job
across the intervening tab-1 render and the full unmount/remount, so the
deep-link's effect does not leak into an unrelated later visit.

**T4 (Esc on tab 3 = Cancel, drawer survives, 1000px).** Resized viewport to
1000x800 (`matchMedia('(max-width: 1100px)').matches === true`), opened the
overlay drawer, opened the modal via the sidebar's dedicated DTP entry button
(see methodology note below), checked "Not listed" on tab 1 (5th box, an
unapplied staged change), switched to Browse tab 3, then pressed a real
`Escape`. Result: hash unchanged (the speculative "Not listed" check was
discarded, not applied), `dialog[open]` was absent afterward, and `.fpanel`
(the drawer) was still present in the DOM with nonzero width — the drawer's
own Esc handler (guarded by `if (document.querySelector('dialog[open]'))
return;` in `FilterPanel.tsx`) correctly no-opped while the dialog was still
mid-close, and did not fire a second, drawer-closing Escape of its own.
Reopening confirmed "Not listed" was unchecked again (staged discarded) and
the modal landed back on tab 1.

**T5 (reopen always lands tab 1).** Verified directly at three separate
points in this session (after T3's Escape, after T4's Escape, and in the
baseline attack-2/3 flow): every fresh open showed `aria-selected=true` on
the `class` tab regardless of which tab was active when the modal was
previously closed. This falls directly out of `useState<DtpTab>('class')`
combined with the fresh-mount-per-open architecture; there is no
`sessionStorage`/`localStorage` or module-level variable that could persist a
non-default tab across opens, and testing found none in practice.

## Methodology note for the next reviewer (new trap, not in v1's list)

**The sidebar's "Active" filter chips and the dedicated DTP filter-row button
both contain the substring "Decline-to-prosecute" in their text.** A
same-tick DOM query
(`[...document.querySelectorAll('.fpanel button')].find(b =>
b.textContent.includes('Decline-to-prosecute'))`) matches whichever renders
first in DOM order — normally the first *chip* (e.g. "Decline-to-prosecute
list: YY (de…"), not the button that opens the modal. Clicking that element
does not open the modal; it silently **removes that filter value**, same as
attack 5's intended chip-removal action. This bit once during this pass (see
raw tool history around the T4 setup): a same-tick click intended to reopen
the modal instead deleted the applied YY value from `dtp_class`, which looked
for a moment like Apply losing a column. Root cause was the query, not the
app: the correct scoping is `.fpanel .entry-btn` (the class the actual filter
row buttons carry, per `FilterPanel.tsx`), which the "Active" chips do not
have (they carry `.chip`). Recovered by re-navigating to a known-good hash and
re-running with the corrected selector; the corrected run reproduced cleanly.
Logging this alongside v1's "two clicks in one evaluate call" trap: **when
scripting a click meant to reopen the modal from the sidebar, scope to
`.entry-btn`, not to text content alone**, or a chip-removal click can be
mistaken for an app bug.

Also reconfirmed v1's existing trap (same-tick DOM read after a `.click()` in
the same `evaluate` callback can observe pre-render state, since React does
not guarantee a synchronous flush before the callback returns): a tab-switch
click and an immediate same-call read of `aria-selected` showed the *old* tab
still selected once, while a follow-up call issued as a separate
`browser_evaluate` showed the correct new tab. Every tab-state and
checkbox-state assertion in this report was taken from a separate tool call
after the action that produced it, not chained in the same `evaluate`.

## Not exercised in this pass

- Attacks 6, 7, 9, 11, 12 from v1's original 12 (lens switch with modal
  closed, Esc-layering at the *drawer* level pre-modal, rapid same-checkbox
  toggling, backdrop-click-as-cancel, custom-grouping-filter isolation) were
  not in the caller's abbreviated list for this re-run and were not
  re-verified. Nothing in the tab refactor touches the code paths those
  attacks exercise (backdrop `onMouseDown` in `Modal.tsx`, the lens/lens
  effect, `apply`'s per-column loop against an unrelated `g:` filter key), so
  risk of silent regression there is low, but this is inference, not
  re-tested evidence.
- Full keyboard-only tab navigation (arrow-key roving tabindex via
  `onTabsKeyDown`) was read in source and looks correct
  (`ArrowRight`/`ArrowLeft`, wraps, moves focus) but was not driven with real
  keypresses in this pass.
- Numbers/content accuracy and screen-reader labeling are out of scope per
  the layered review plan (passes 1, 2, 4).

## Bottom line

12 of 12 attacks pass: all 7 attacks carried over from v1's proven list (1,
2, 3, 4, 5, 8, 10) reproduce identically on the tabbed rebuild, and all 5
new tab-specific attacks (T1-T5) pass. The staging/commit/discard contract —
fresh-mount re-derivation, Cancel/Esc/backdrop all bypassing `onSetFilter`,
Apply as the sole write path covering both columns unconditionally of active
tab — did not change when the internals were rebuilt around tabs, and testing
found no case where tab switching, the Browse tab's independent local state
(`browseConflicts`, the search/radio filter inside `DtpBrowseTab`), or the
new per-tab badge counts leaked into or corrupted the shared `staged` object.
Zero Critical or Important findings. One test-harness trap is logged above
(chip-vs-filter-button selector collision) so it doesn't cost the next
reviewer time; it is not an application defect.
