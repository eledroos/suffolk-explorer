# DTP filter modal — adversarial review pass 3 of 5 (state machine)

Branch: `dtp-filter-modal`. Driven live against `npm run dev -- --port 5177`
with Playwright MCP. Code read: `src/ui/DtpFilterModal.tsx`, `src/ui/dtpModel.ts`,
`src/ui/Modal.tsx`, `src/ui/FilterPanel.tsx`, `src/ui/MultiSelect.tsx`,
`src/engine/view.ts`.

Mechanism established before attacking: `FilterPanel` mounts `DtpFilterModal`
conditionally (`{dtpOpen && <DtpFilterModal .../>}`), so every open is a fresh
mount and `useState(() => stageFromFilters(view.filters))` re-derives staged
state from the current `view.filters` on every open. Cancel, backdrop click,
and Esc all route through the same `onClose` (`setDtpOpen(false)`), which
unmounts the component and discards `staged` without ever calling
`onSetFilter`. Apply is the only path that calls `onSetFilter`. This
architecture is what makes attacks 1, 2, 5, and the invented backdrop-click
attack pass structurally, not by accident.

## Per-attack results

| # | Attack | Result |
|---|--------|--------|
| 1 | Toggle three boxes, Cancel, reopen: staged = applied (none) | PASS |
| 2 | Check YY, Apply, reopen, uncheck YY, Cancel, reopen: YY still checked | PASS |
| 3 | Check all 5 dtp_class, Apply: normalizes away (no chip, "any", hash has no dtp_class key) | PASS |
| 4 | Apply YY + Current list, copy URL, open in new tab: both filters present, modal reopens staged | PASS |
| 5 | Apply YY, close modal, remove YY chip in sidebar, reopen modal: nothing staged | PASS |
| 6 | Apply YY, switch lens Filings→Dispositions with modal closed, reopen: counts changed, YY still staged | PASS |
| 7 | 1000px viewport, modal open, Esc: dialog closes, drawer stays open; second Esc then closes drawer | PASS |
| 8 | Clear both, Apply: chips gone, summary "any" | PASS (see methodology note) |
| 9 | Rapid same-checkbox toggling: 6 clicks (even) → unchanged after Apply; 5 clicks (odd) → toggled after Apply | PASS |
| 10 | Select all then uncheck one, Apply: exactly 4 values, chip count 4 | PASS |
| 11 (invented) | Backdrop click (mousedown on `<dialog>` itself, not modal body) with a pending toggle: behaves as Cancel, discards the toggle | PASS |
| 12 (invented) | Custom grouping filter (`g:preset_disposition_family`) applied, then DTP modal opened/changed/Applied: grouping filter untouched in the resulting hash | PASS |

**12/12 PASS. Zero findings, Critical or Important.**

## Detail on attacks worth narrating

**Attack 3 (select-all normalization).** Checked all five `dtp_class` boxes
(39,106 + 30,563 + 45,088 + 44,501 + 1,876 charges) and clicked Apply. The URL
hash collapsed to `#e30`. Decoded the base64url token the same way
`src/engine/view.ts` does (`atob` after `-`/`_` restoration and `=` padding,
then `JSON.parse`): payload is `{}` — no `filters` key at all, so `dtp_class`
is absent, not merely empty. Sidebar summary read "any" and no chip appeared.
Matches the spec's requirement that normalization runs against the union of
known cards and unknown data values, and matches `MultiSelect.tsx` line 36's
behavior exactly.

**Attack 4 (URL round-trip, new tab).** Applied YY (`dtp_class`) + Current list
(`dtp_review`), copied `location.href`
(`.../#eyJmaWx0ZXJzIjp7ImR0cF9jbGFzcyI6WyJZWSAoZGVjbGluZSBsaXN0KSJdLCJkdHBfcmV2aWV3IjpbIkN1cnJlbnQgbGlzdCJdfX0`),
opened it in a brand-new tab. Confirmed `location.href` matched before reading
anything (per instructions). New tab showed both chips, correct summary ("On
the decline list · revie…"), correct filtered count (36,688 of 200,630), and
reopening the modal in the new tab showed both YY and Current list checked.
No shared state leaked between tabs; the reproduction came entirely from the
hash.

**Attack 7 (Esc layering).** At 1000px viewport the sidebar becomes an overlay
drawer with a scrim (confirmed via `matchMedia('(max-width: 1100px)').matches
=== true`). Opened the drawer, opened the DTP modal (focus landed on a button
inside the dialog, confirming the native `showModal()` focus containment
fired). A real `Escape` keypress (via `page.keyboard.press`, not a synthetic
event) closed only the `<dialog>`; the `.fpanel` drawer and its scrim were
still in the DOM afterward. A second `Escape` with no dialog open then closed
the drawer, proving the guard in `FilterPanel`'s own keydown handler
(`if (document.querySelector('dialog[open]')) return;`) is doing real work
and not just happening to no-op.

**Attack 8 and the double-click methodology trap.** First pass at this attack
called `clearBtn.click()` immediately followed by `applyBtn.click()` inside a
single synchronous `page.evaluate` callback, with no yield to the browser
event loop between them. Result: the applied filter did **not** clear; the
URL hash kept `dtp_class=YY`. This looked like a critical bug (Apply reading
stale state) but re-running the same sequence as two separate
`browser_evaluate` calls (i.e., two real, separately-dispatched click events,
the same as a real user's two mouse clicks) cleared the filter correctly.

Root cause understood, not just observed: `clearBoth` and `apply` are plain
event handlers, not chained functional state updates. `clearBoth` calls
`setStaged(...)`; `apply` reads `staged` from its own render closure. When
both handlers run inside one synchronous JS callstack with no yield, React
never gets a chance to re-render and hand `apply` a fresh closure between the
two calls, so `apply` sees pre-clear `staged`. This does not reproduce for any
real input path: distinct native click events (real mouse clicks, or
Playwright's own `browser_click`, or even a very fast double-click) are always
separate browser tasks, and React flushes state between discrete event
dispatches. It also does not reproduce for the checkbox-toggle path (attack
9), because `toggle()` uses the functional updater form
(`setStaged((s) => ...)`), which composes correctly across queued updates
regardless of flush timing. Logging this so the next reviewer doesn't waste
time rediscovering it: **when chaining two different button handlers via
`element.click()` in one `evaluate` call, insert a separate tool call between
them**, or the test harness itself manufactures a false positive.

**Invented attack 11 (backdrop click = Cancel).** `Modal.tsx`'s `onMouseDown`
checks `e.target === ref.current` to distinguish a backdrop click from a click
inside `.modal-body` (native `<dialog>` routes `::backdrop` clicks to the
dialog element itself). Toggled NN off (dialog had NN/YY/NY/NS applied from
attack 10), dispatched a `mousedown` `MouseEvent` directly on the `<dialog>`
element. Modal closed; reopening showed all four original categories still
checked, including NN — the toggle was discarded exactly like Cancel. This
path is easy to regress (e.g., wrapping the modal body in an extra div without
forwarding the ref check) and wasn't in the spec's named attack list.

**Invented attack 12 (custom-grouping interplay).** Spec section "State and
semantics" promises the DTP modal writes only `dtp_class`/`dtp_review` through
`onSetFilter` and nothing else about filter composition changes. Set a
`g:preset_disposition_family` filter to `["Plea"]` via its ordinary
`MultiSelect`, confirmed it landed in the hash alongside the already-applied
DTP filters, then opened the DTP modal, unchecked NS, and clicked Apply.
Decoded resulting hash:
`{"dtp_class":["NN (prosecute)","YY (decline list)","NY (presumption against)"],"g:preset_disposition_family":["Plea"]}`.
The grouping filter survived untouched; only `dtp_class` changed. Confirms the
modal's `apply()` (which calls `onSetFilter` once per `DTP_COLUMNS` entry, not
a bulk filter replace) can't clobber unrelated filter keys.

## Not exercised in this pass

- localStorage persistence of custom groupings themselves (as opposed to their
  filter selections) — out of scope for the DTP modal's own state machine and
  covered by whatever owns grouping CRUD.
- Numbers/content accuracy (that's pass 1/2's job per the spec's layered
  review plan).
- Full keyboard-only navigation and screen-reader labeling (pass 4).

## Bottom line

12 of 12 state-machine attacks pass, including two invented beyond the
spec's list (backdrop-click-as-cancel, custom-grouping-filter isolation).
Zero Critical or Important findings. The one apparent bug (attack 8's first
attempt) was a test-harness artifact from firing two button clicks in a single
unyielded JS callstack, not a defect in the app; verified by reproducing
cleanly with separated events and by reading the `apply`/`clearBoth` source to
confirm why chained-but-not-yielded calls behave differently from any real
input path. The modal's staging/commit/discard contract holds under every
round-trip, normalization, cross-tab, cross-lens, and layered-dialog scenario
tried.
