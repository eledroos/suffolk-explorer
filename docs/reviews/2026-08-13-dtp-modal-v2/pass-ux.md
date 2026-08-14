# DTP modal v2 — adversarial review (UX / accessibility)

Branch: `dtp-modal-v2`, HEAD `3566bd4`. Driven live against `npm run dev -- --port
5272 --strictPort` with Playwright MCP (`browser_navigate`, `browser_snapshot`,
`browser_click`, `browser_evaluate`, `browser_press_key`, `browser_resize`,
`browser_take_screenshot`, `browser_close`). `location.href` confirmed after
every navigate. Code read: `src/ui/DtpFilterModal.tsx`, `src/ui/Modal.tsx`,
`src/ui/DtpBrowseTab.tsx`, `src/ui/FilterPanel.tsx`, `src/styles.css`. Server
killed at the end of the pass (`lsof -ti:5272 | xargs kill`).

Screenshots: the brief's `/tmp/dtp-v2-ux/` is outside this tool's allowed
filesystem roots, so screenshots went to
`/Users/nasser/_dev/nasser-blog-posts/.playwright-mcp/dtp-v2-ux/` instead
(not committed; referenced here by filename).

## Methodology note

Per the pass4-ux.md precedent (`docs/reviews/2026-08-12-dtp-filter-modal/pass4-ux.md`,
"Methodology note" section, read before writing up any visual finding, as
instructed): this pass hit the **same dark-mode false alarm twice** and one
new React-timing false alarm. Recording both so a re-reviewer doesn't redo the
investigation.

1. **Dark mode looked like the dialog stayed light**, twice, from two
   different screenshots (`08-1440-dark-browse.png` and again eyeballing
   before checking `09-1440-zoom200.png`). Both times `getComputedStyle`
   reported the dialog background as `rgb(26, 26, 25)` (`#1a1a19`, the correct
   `--surface` dark value). Pixel-sampled `08-1440-dark-browse.png` directly
   with PIL at four interior points (`(700,150)`, `(900,400)`, `(500,200)`,
   `(1100,300)`); all four returned exactly `(26, 26, 25)`. The PNG is
   genuinely dark; my own visual read of the thumbnail was wrong both times.
   Given this happened twice independently in one pass (on top of v1's own
   instance of the identical false alarm), I stopped trusting my eyeballed
   light/dark read entirely for this pass and confirmed every remaining dark-mode
   contrast claim below with `getComputedStyle` plus a computed WCAG contrast
   ratio, not visual inspection. **False alarm, not reported as a finding.**
2. **React render-timing produced two contradictory `document.activeElement`
   reads** when a `.click()` and a DOM query were issued inside the same
   `evaluate()` call immediately after toggling the Filters drawer: the query
   ran before React flushed the state update, so `.fpanel` appeared not to
   exist even though `aria-pressed` had already flipped. Splitting the click
   and the query into separate `evaluate()` round-trips resolved it
   consistently. Not a product bug; a note for anyone re-running this pass not
   to click-and-query in one synchronous script when the click triggers a
   React state update.
3. **A stray `Array.find` matched the wrong button.** Querying
   `document.querySelectorAll('button')` for text starting with
   `"Decline-to-prosecute"` matches *two* buttons: the sidebar entry button
   AND the active-filter chip's remove button (`"Decline-to-prosecute list: YY
   (de…"`), which sits earlier in the DOM. `find()` silently clicked the
   remove button and cleared the filter instead of opening the modal. Fixed by
   querying `.entry-btn` directly. Not a product bug; a note that any future
   automation against this sidebar should scope by class, not by text prefix.

None of these three are reported as findings below.

## Per-check results

| # | Check | Result |
|---|-------|--------|
| 1 | Keyboard walkthrough: Filters → DTP row → modal; tablist roving tabindex + Arrow keys; Tab into panel content; Browse tab reachability; Esc semantics per tab; focus return on close | PASS (2 Important, 1 Minor new) |
| 2 | Accessibility tree: tab names incl. badges, chip roles, share-bar `aria-hidden`, table headers, conflict-flag text, download-link semantics | PASS (1 Important — same badge defect as check 1) |
| 3 | Viewports 1440 / 1100 / 1000 / 800 / 390 with modal open on each tab; table scroll containment at 390; footer reachable; two-line sidebar at drawer widths | PASS |
| 4 | Dark mode: tabs, chips, share bars, table, conflict flags | PASS (see methodology note; 0 findings, 1 tight-but-passing contrast noted for the record) |
| 5 | Zoom 200% proxy; all disclosures open at 390 | PASS |
| 6 | v1's two waived minors (aria duplication, phantom tab stop) reconfirmed; v1's chevron/label-squeeze cosmetics reconfirmed | Phantom tab stop: unchanged. Aria duplication: structurally superseded (see below). Chevron + label-squeeze: **both resolved** in v2, confirmed at 1440 inline and 1000px drawer |

**0 Critical, 3 Important, 2 Minor.**

## Findings

### Important — tab badge text has no space, so screen readers run the label into the count

**Repro:** Check any box on tab 1 or tab 2. `document.querySelector('[role="tab"]').textContent`
returns `"Decline list· 1"` — no space between "list" and the middot. Same on
tab 2: `"Review status· 1"`. This is the literal DOM text content, which is
also the tab's accessible name (confirmed via `browser_snapshot`:
`tab "Decline list· 1" [selected]`), not just a `textContent` artifact.

**Cause:** `DtpFilterModal.tsx` lines 245-246:

```tsx
{t.label}
{t.col && badge > 0 && <span className="dtp-tab-badge">· {badge}</span>}
```

Two JSX expression children with a newline between them in source collapse to
no whitespace in the rendered DOM. `.dtp-tab-badge { margin-left: 5px; }`
(`src/styles.css` line ~1918) supplies visual spacing, so a sighted user sees
"Decline list · 1" correctly spaced — this is purely an accessible-name defect,
invisible on screen.

**Why Important:** this is a brand-new interactive element (the tablist with
staged-count badges) explicitly in scope for this pass, and it fires on the
single most common post-interaction state: as soon as a user checks any box,
every screen-reader user tabbing to or arrowing through the tab bar hears the
tab name and count mashed together with no natural pause, on every visit to
this modal after the first checkbox is touched. Not Critical: the tab still
functions, `aria-selected` still communicates state correctly, and the
information (which tab, how many staged) is still technically present in the
name, just not legibly separated. One-line fix: insert a literal space, e.g.
`{t.label}{' '}{badge > 0 && ...}` or put the space inside the badge span's
own text (`{' · '}{badge}`).

### Important — the caveat's "See the conflicting rows" deep-link drops focus to `<body>` with no announcement that the tab changed

**Repro:** Open the modal, on tab 1 activate "See the conflicting rows" (click
or Enter; it's a real `<button class="linklike">`). The click correctly
switches to tab 3 and pre-selects the Conflicts chip — reconfirmed by
`aria-checked="true"` on the Conflicts radio and by the table showing only
conflict rows, both in a clean from-scratch trial. But
`document.activeElement === document.body` immediately after, reproduced
identically across two independent full-reload trials (once with an incidental
disclosure open on the source panel, once without).

**Cause:** `DtpFilterModal.tsx` lines 103-106:

```tsx
const onConflictLink = () => {
  setBrowseConflicts(true);
  setTab('browse');
};
```

Switching tabs unmounts the panel containing the just-clicked button (it's a
conditional render at the same JSX position `tab === 'browse' && (...)` that
tab 1's content occupied). The browser has nothing to hand focus to when its
currently-focused element is removed from the DOM, so it falls back to `body`.
Nothing in `onConflictLink` (or anywhere else) explicitly moves focus to the
new tab, its panel, or a heading inside it.

**Severity and what I could and couldn't pin down:** this is Important, not
Critical, because focus does **not** escape the modal — in both trials, the
very next real `Tab` press landed back inside the `<dialog>` subtree (once on
the dialog element itself, once directly on the "Download the lists" link),
never on background page content, so the native modal's inertness held. But
the *specific* landing spot differed between the two trials (dialog element vs.
download link) depending on what was rendered/removed at the moment of the
click — this is Chromium resuming its tab-order search from the removed
element's former DOM position rather than restarting from the document head, a
plausible but implementation-specific heuristic, not something the app
controls or a user could learn to predict. The one fact that reproduced
identically both times, and the actual finding, is simpler than that
downstream uncertainty: **there is no explicit focus management at all** after
a programmatic tab switch, so a screen-reader user who activates this link
gets no announcement that anything happened — no "moved to Browse the lists
tab" cue a screen reader would normally give when focus lands on the newly
selected tab or a heading in its panel. Standard SPA-navigation practice (and
the WAI-ARIA APG's own tabs pattern, for the "activate a tab programmatically"
case) is to move focus to the newly active tab or the first heading in its
panel; this implementation does neither. Fix: after `setTab('browse')`, focus
the "Browse the lists" tab button or the panel's first heading (a `ref` + a
`useEffect` keyed on `tab === 'browse' && browseConflicts` would do it without
touching the plain tab-click path).

### Important (same defect as the first finding, listed separately per the check-2 accessibility-tree ask) — tabpanel accessible name inherits the same missing-space text

**Repro:** `tabpanel "Decline list· 1"` in the snapshot — `aria-labelledby`
points at the tab button (`DtpFilterModal.tsx` line 201:
`aria-labelledby={\`dtp-tab-${tabKey}\`}`), so the panel's accessible name is
computed from the same malformed text as the tab. Fixing the tab's text fixes
this for free; not a separate code location.

### Minor — Escape needs two presses to close the modal when the Browse tab's search field has focus and text

**Repro:** Open the modal, go to tab 3, type into "Search charge
descriptions," press Escape once: the search field clears
(`document.activeElement` stays the input, dialog stays open) — this is
Chromium's native `<input type="search">` behavior, not app code. Press Escape
a second time: the dialog closes and focus returns correctly to the sidebar
entry button. Confirmed this is state-dependent, not tab-dependent: with the
search field empty, one Escape press closes the dialog immediately, same as
tabs 1-2. So the two-press requirement only appears in the specific combination
of "focused in the search box" + "box has text."

**Why Minor:** self-resolving (a second Escape, or a click on Close/backdrop,
or Tab-away-then-Escape all work), matches a well-documented cross-browser
native behavior for search inputs nested in a cancelable dialog, and is easily
discoverable (the visible search text disappearing is its own feedback that
something happened). Same class as the pre-existing phantom-Tab-stop minor
below: a native platform quirk interacting with a new v2 surface, not a app
logic bug. If it's ever worth fixing, changing the input's `type` from
`search` to `text` (losing the native clear-X affordance) would remove the
double-Escape behavior, but that's a real trade-off, not a free fix.

### Reconfirmed, unchanged, not worsened — phantom `<body>` Tab stop on forward wrap

**Repro:** Tab all the way to Apply (last footer button on tabs 1-2), press
Tab once more: `document.activeElement` becomes `document.body` (no visible
focus ring). Press Tab again: focus lands correctly on Close. Identical to
pass4-ux.md's finding (same root cause: `Modal.tsx` has no hand-rolled focus
trap, relies entirely on native `showModal()`, and Chromium's native
forward-wrap-via-`<body>` is a known, documented quirk of that
implementation). Not worsened by v2's new tab bar or footer changes — still
exactly one dead press before a clean wrap.

### Reconfirmed — the v1 aria-label/h3 duplication no longer exists in its original form

**What changed:** v1's minor was `<section aria-label="The decline list of
161,134 charges in the current view">` exactly duplicating the visible `<h3>`
text a screen reader would hear twice in a row. In v2 the section became
`<div role="tabpanel" aria-labelledby="dtp-tab-class">`
(`DtpFilterModal.tsx` line 198-202), so the panel's accessible name is now
derived from the **tab's** short label ("Decline list", or "Decline list· 1"
per the finding above) — not the long `<h3>` text. Confirmed live:
`tabpanel "Decline list"` vs. `heading "The decline list of 161,134 charges in
the current view"` are no longer the same string. This is a byproduct of the
tabs refactor, not a deliberate a11y fix, but it does mean the specific v1
minor as filed no longer applies; there's no new duplication to replace it
(a short tab name followed by a fuller heading is the normal, expected pattern
for a WAI-ARIA tabpanel and not something to flag).

### Reconfirmed resolved — DTP sidebar row's missing chevron (v1 minor, deferred through all of v1)

**Repro:** `FilterPanel.tsx` line 196 now renders `<IconChevron open={false}
/>` unconditionally inside `.entry-line1`, matching every sibling row. Screenshots:
`06-390-drawer-open.png` (inactive, 390px drawer, chevron present, aligned
with "Crime type," "Court," etc.) and `13-1000-drawer-active.png` (active
state, 1000px drawer, chevron + accent-colored label + dot, aligned). v1's
pass4-ux.md and progress.md both filed this as a deferred, never-fixed minor
through v1's entire lifecycle (`progress.md` line 18: "DTP entry lacks
IconChevron, ~20px misalignment vs sibling rows"). It is fixed now, as a
byproduct of the two-line entry rebuild in v2 Task 3.

### Reconfirmed resolved — active-filter label squeeze (v1 minor)

**Repro:** `07-1440-entry-active.png`. With "On the decline list" checked and
applied, the sidebar row now reads "Decline-to-prosecute ●" on line 1 (full,
untruncated) and "On the decline list · review: any" on line 2 (full,
untruncated, wrapping normally) — no `…` anywhere. Matches the spec's Task 3
Step 4 instruction to remove the `truncate()` call. v1's version squeezed to
"Decline-t…" / "On the decline list · revie…"; that's gone.

## Detail on checks worth narrating

**Check 1, keyboard path.** Verified the two-line entry is a single Tab stop
(not two) by focusing the preceding "Charge description" filter button via
`.focus()` and pressing one real `Tab`: lands directly on `.entry-btn`. From
there, `Enter` opens the dialog; initial focus lands on the header Close
button (native `showModal()` default). Real `Tab` presses confirmed the order:
Close → the new inline memo link ("published a list," new in v2 since
`MEMO_URL` is now set — this is a genuinely new tab stop v1 never had, since
v1's `MEMO_URL` was `null`) → header `<summary>` → tablist (one stop, roving
tabindex correctly implemented: `tabIndex={active ? 0 : -1}` per element,
confirmed `ArrowRight`/`ArrowLeft` move both selection and focus together and
wrap correctly in both directions, `Home`/`End` not implemented on this
tablist but not required by the brief) → straight into the active panel's
first checkbox (correctly skips the `aria-hidden` share bar) → checkbox/More
pairs for all 5 cards (verified card 1 explicitly, then confirmed the
aggregate 8-Tab distance from card 2's checkbox to the caveat button matches
exactly `4 remaining cards × 2 stops`) → caveat link → Clear both → Cancel →
Apply → phantom `body` stop → wraps to Close. Same pattern verified
independently for tab 2's panel (checkbox reachable, badge updates). Browse
tab: Tab from the tab button lands on the download link, then the search
input (`type="search"`, `aria-label="Search charge descriptions"`), then the
chip radiogroup (one stop, roving tabindex, `Home`/`End`/all four arrow keys
confirmed — `ArrowUp`/`ArrowDown` also move selection, a nice extra beyond
the tablist). Table rows/cells are correctly non-focusable (no interactive
elements inside `<td>`, the flag glyph is `role="img"` not a button).

**Check 2, accessibility tree.** Fact chips (`.dtp-chip` on tabs 1-2, e.g.
"Worksheet YY strings" / "69") render as `generic` in the snapshot — plain
`<span>`s per `DtpFilterModal.tsx` lines 148-152, confirmed **not** buttons,
satisfying the brief's explicit "must NOT read as buttons." Browse-tab filter
chips (`.dtp-browse-chipbtn`) are real `role="radio"` inside a `role="radiogroup"
aria-label="Filter the lists"`, correctly distinct in both role and visual
treatment from the fact chips. Share bars (`.dtp-bar`) carry `aria-hidden="true"`
in source and are correctly absent from the snapshot tree. Table headers are
real `<th>` (`DtpBrowseTab.tsx` lines 168-173) — no `scope="col"`, but this is
inherited from the pre-existing shared `.aggtable`/`.tablewrap` styling used
elsewhere in the app (not new to this feature), and modern browsers/AT infer
column scope correctly for this simple one-row-`<thead>` shape; not filed as a
finding. Conflict flag: `role="img" aria-label="Conflict: on the YY tab and in
the review's disagreed section." title="..."` — has real accessible text,
confirmed via snapshot. Download link: `<a href="/downloads/suffolk-dtp-lists.xlsx"
download>Download the lists (XLSX)</a>` — filename is inferred by the browser
from the href (empty `download=""`), format hint "(XLSX)" is in the visible
and accessible text; adequate, not filed.

**Check 3, viewports.** At 1440/1100/1000/800/390, with the modal open on
each of the three tabs: `document.documentElement.scrollWidth ===
window.innerWidth` held at every combination tested (1100/browse, 1000/browse,
800/browse, 390/all three tabs), confirming no page-level horizontal overflow
introduced by the widened 880px `.modal-wide` or the Browse tab's table. At
390px specifically, `.dtp-browse-tablewrap` carries its own overflow
(`scrollWidth` 929px vs. `clientWidth` 322px) — the table scrolls inside its
own container, the page does not (screenshots `02-390-browse.png`,
`03-390-tab1.png`). Footer reachability confirmed directly at 390px by
scrolling `.modal-body` to `scrollHeight` with all 10 disclosures open
(`04-390-tab1-scrolled-footer.png`: Apply/Cancel/Clear both fully visible,
statute-citation text like "c. 266 s. 127" wraps cleanly, no clipping); at
1100/1000/800 this relies on the same unchanged `.modal-body { overflow-y:
auto }` mechanism v1 verified end-to-end and this pass reconfirmed works at
390, so it was spot-checked via the `scrollWidth`/overflow assertion rather
than a screenshot at every width. Two-line sidebar entry confirmed correct in
the drawer specifically (not just inline) at both 390px (inactive:
`06-390-drawer-open.png`) and 1000px (active, full untruncated two-line
summary: `13-1000-drawer-active.png`) — this required two attempts at each
width because of the click/query React-timing trap in the methodology note
above; the first attempt at each width silently toggled the drawer closed
instead of open and was caught by re-checking `aria-pressed` in a separate
`evaluate()` call before screenshotting.

**Check 4, dark mode.** See methodology note. After the two visual false
alarms, every claim below is `getComputedStyle` plus a computed WCAG contrast
ratio (relative-luminance formula run in-page), not a screenshot read.
Dialog: `#1a1a19` bg, white text — correct. Tab bar: active tab `#1a1a19`/white
(fine), inactive tab text `rgb(137,135,129)` on the dialog bg — 4.85:1, passes
AA. Fact chips: bg `#0d0d0d` (`--page`), value text white, label text
`rgb(137,135,129)` — all comfortably passing. Share bar: track is accent blue
at 16% alpha, fill is solid `rgb(57,135,229)` — renders as a real visible bar,
not washed out. Browse chips: inactive `rgb(195,194,183)` on `#0d0d0d` (10.85:1,
excellent); active/selected chip is **dark text (`#1a1a19`) on the blue accent
fill** (`rgb(57,135,229)`) — 4.79:1, passes AA for normal text but is the
tightest pairing checked. Conflict flag glyph: `rgb(208,59,59)` (a `--crit`
red) on the dialog bg — 3.62:1, which clears WCAG 1.4.11's 3:1 non-text/icon
threshold (appropriate here, since it's a symbolic glyph backed by a full
`aria-label`/`title` text alternative, not body text) but would not clear the
stricter 4.5:1 text threshold if judged as text. Not filed as a finding —
noted for the record since it's the tightest pairing on a new dark-mode
surface and worth knowing about if the crit red token ever gets reused
somewhere it's judged as text. Conflict row tint: `color(srgb 0.98 0.698 0.098
/ 0.08)` (8% amber) on the `<td>`, confirmed applied in dark mode; this is
supplementary (the flag glyph + its text alternative already carry the
meaning), so no "color alone" WCAG concern. Light mode spot-check (not the
focus of this pass, but checked for due diligence): dialog bg `rgb(252,252,251)`,
browse chip contrast 4.30:1, conflict flag 4.68:1 — no new problems.

**Check 5, zoom.** `document.body.style.zoom = '2'`, verified via real
geometry (`dialog h2` width doubled exactly, `222.66px → 445.32px`, ratio
1.9999) rather than the unreliable `getComputedStyle(...).zoom` pass4-ux.md
already flagged. Screenshots at 200% on tab 1 (`09-1440-zoom200.png`,
scrolled-to-footer `10-1440-zoom200-footer.png`) and tab 3
(`11-1440-zoom200-browse.png`): tab bar, fact chips, share bars, filter chips,
and the Browse table's visible columns all render without clipping or
overlap; the Browse table's off-screen columns scroll within their container
exactly as they do at 390px width, which is the expected, equivalent behavior
at 2x zoom on a 1440px viewport (an effective 720 logical px of layout width).

**Check 6, long content at 390.** `document.querySelectorAll('dialog
summary').forEach(s => s.click())` opened all disclosures (header + 5 cards
section 1 + 4 cards section 2) at 390px width simultaneously;
`document.documentElement.scrollWidth` stayed at 390 (no overflow introduced
by the long unbroken statute-citation strings in the expanded paragraphs).
`.modal-body.scrollHeight` grew to 2310px against a 690px `clientHeight`,
confirmed scrollable to the footer with screenshot proof
(`04-390-tab1-scrolled-footer.png`).

## Bottom line

Zero Critical findings — the modal never leaks keyboard focus into background
page content at any point tested, including the one surface (the conflict
deep-link) whose behavior is genuinely non-deterministic between trials, and
dark mode, viewports 1440 through 390, and 200% zoom are all correctly themed
and unclipped on every new v2 surface once checked computationally rather than
visually. Three Important findings, all screen-reader-facing and all on
brand-new v2 surfaces: the tab badge's missing space breaks the accessible
name for any tab with staged filters (and by inheritance, its tabpanel's
name); the conflict deep-link moves the user to a different tab with zero
focus management or announcement. Two Minor findings: a native
`<input type="search">` quirk that makes Escape take two presses on the
Browse tab specifically when the search field has focus and text, and the
pre-existing, unworsened Chromium phantom-Tab-stop on forward wrap out of the
footer. On the positive side, all three of v1's carried-forward cosmetic
minors — the missing sidebar chevron, the active-filter label squeeze, and
(structurally, if not deliberately) the aria-label/h3 duplication — no longer
reproduce in v2, confirmed live at both inline and drawer widths.
