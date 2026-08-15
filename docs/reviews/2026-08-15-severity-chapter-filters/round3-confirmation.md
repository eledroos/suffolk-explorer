# Round 3 confirmation sweep — severity-chapter-filters (branch severity-chapter-filters, HEAD 7ceda50)

Abbreviated confirmation sweep across all four dimensions, run after two adversarial
rounds already fixed/adjudicated their findings. Dev server localhost:5173 (Vite,
already running). duckdb 1.5.5 via repo `.venv`. Playwright MCP for browser work.

Bar: zero new Critical/Important findings. Result: **bar met.** 20/20 checks pass;
one Minor content flag (not gating) plus notes.

## 1. NUMBERS — 5/5 pass

All ground truth computed directly against `../assembled/hayden-era-charges-2022-2025.csv`
and `../assembled/pre-2022-composite.csv` with duckdb, reproducing the app's exact lens
semantics (`filed_in_window`/`disposed_in_window`/no window filter for Filings/
Dispositions/Both) rather than reusing the unscoped totals in
`docs/specs/severity-chapter-ground-truth-results.md`.

| # | Check | Ground truth (SQL) | UI value | Result |
|---|---|---|---|---|
| 1 | Severity Unclassified card, default view (Filings lens, no filters, history off) | 2,095 | 2,095 | PASS (Felony 46,568 / Misdemeanor 94,918 / Civil infraction 17,553 also matched) |
| 2 | Chapter modal, c. 265 row, default view | 37,267 | 37,267 | PASS |
| 3 | Severity Felony count with chapter=c. 265 applied (own-column-stripped count view) | 19,486 | 19,486 | PASS |
| 4 | Chart total, severity=Felony + court=Roxbury Court, Dispositions lens, Table, x=disposed_under | 7,653 total (Hayden 7,607 / Rollins 46) | 7,653 total (Hayden 7,607 / Rollins 46) | PASS |
| 5 | History on, Both lens, Not-graded (pre-2022) card, no other filters | 1,092,889 | 1,092,889 | PASS |

Bonus cross-checks along the way also matched ground truth exactly: c. 265 combined
(hayden + history) = 269,312; Felony total on Both lens with history = 61,117 (matches
`severity-chapter-ground-truth-results.md` scenario 1).

## 2. STATE — 5/5 pass

1. **Stage-cancel-reopen, both modals.** Severity: checked Felony, clicked Cancel,
   entry reverted to "any," reopened — checkbox unchecked. Chapter: checked c. 265,
   typed "zzz" into search, clicked Cancel, entry reverted to "any," reopened —
   checkbox unchecked and search box empty. Neither modal's Cancel path leaked staged
   state.
2. **Full-selection collapse, severity.** With history on (5 cards visible), checked
   all 5 and Applied. Entry reverted to "Severity any" and the URL hash dropped the
   `filters` key entirely (confirmed via `location.hash`) — matches
   `normalizeSeverity`'s "everything visible checked -> []" contract.
3. **URL round-trip, 3 filters, new tab.** Built severity=Felony + statute_chapter=c.
   265 + court=Roxbury Court, Both lens, history on, Table, x=disposed_under (3,679
   charge rows). Copied `location.href`, opened it in a fresh tab (`browser_tabs new`),
   waited for the history parquet to reload, and the new tab reproduced the identical
   "3,679 of 1,293,519 charge rows" and "Filters 3" badge.
4. **Chip removal syncs modal.** Removed the "Statute chapter: c. 265" chip from the
   Active section; the Statute chapter filter-panel entry immediately reverted from
   "c. 265" to "any" (checked via `browser_find`, no reopen needed to see the sync).
5. **Escape from chapter search at 390px leaves the drawer open.** Resized to
   390x844, opened the Filters drawer (already an overlay drawer at this width, "Close
   filters" button present), opened the Statute chapter modal, focused `.chapter-search`,
   pressed Escape. `dialog[open]` count went to 0 (modal closed) while `.fpanel` stayed
   present and `display !== 'none'` (drawer stayed open and visible). Matches the
   `stopPropagation` fix in `ChapterFilterModal.tsx`'s search `onKeyDown` and the HEAD
   commit message ("Escape in chapter search no longer reaches the drawer").

## 3. UX — 5/5 checks, all clean

1. **Chapter search autofocus.** On modal open, `document.activeElement` is
   `.chapter-search` (confirmed via evaluate, both at 1440px and 390px). Matches the
   `requestAnimationFrame` focus effect and its documented rationale for why plain
   `autoFocus` doesn't work inside a native `<dialog>`.
2. **c. 276 row at 390px.** Screenshot of the filtered ("276") row: checkbox, "c. 276,"
   the 129-character title wrapping cleanly to 3 lines, count, thin bar, and the
   external-link icon all render without overlap, clipping, or horizontal scroll.
3. **Dark mode, both modals, element-targeted screenshots.** Session was already in
   dark theme throughout. `dialog[open]` screenshots of both Severity and Statute
   chapter modals show correct contrast, borders, checked-state highlighting, bars,
   and link icons; no unstyled or washed-out regions.
4. **Link icons absent on c. 258 / c. 279C / No statute code.** Verified by searching
   each in the chapter modal: c. 258 — no icon (c. 258B alongside it, not in
   `MISCODED_TOKENS`, does have one); c. 279C — no icon, no title; "No statute code" —
   no icon. Matches `MISCODED_TOKENS` / `chapterHref`'s null-for-`NO_CODE_VALUE` logic.
5. **Severity "More" disclosures open with working links.** Opened all 5 `<details>`
   at once (`d.open = true`). Per-card content is paragraphs only — no card in
   `SEVERITY_CARDS.detail.links` carries a `links` array in the current model, so
   there is nothing to click inside the cards themselves; this is the model's design,
   not a bug. The two links that do exist live in `SEVERITY_HEADER` (rendered above the
   card list, not per-card) and both resolve: `href` values checked via evaluate —
   `https://www.mass.gov/doc/master-crime-list` and
   `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=274`, both `target=_blank
   rel="noopener noreferrer"`.

One test-harness note, not an app defect: setting `.chapter-search`'s `.value` directly
via `element.value = 'x'` plus a dispatched `input` event does **not** flow through
React's controlled-input tracking (rowCount stayed at all 125+ rows). Switching to
Playwright's `browser_type` (`locator.fill()`) fixed it immediately (rowCount 1 for
"276"). Recording this in case a later round's screenshots look "unfiltered" — check
the interaction method before treating it as a filter bug.

No console errors or warnings appeared during the entire sweep
(`browser_console_messages` at `warning` level, all-time: 0/0).

## 4. CONTENT — skim complete, one Minor flag

Read every user-visible string in `src/ui/severityModel.ts` and `src/ui/chapterModel.ts`
once as a hostile reader. Cross-checked the parts that are checkable from outside the
repo:

- **G.L. c. 274 § 1 felony/misdemeanor dividing line** (`SEVERITY_HEADER`): "a crime
  punishable by imprisonment in state prison is a felony; every other crime is a
  misdemeanor" — this is the standard statutory definition, correct.
- **c. 234 (Juries) repeal comment**: WebFetch of
  `malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=234` confirms the live page
  shows title "JURIES" and "[Repealed, 2016, 36, Sec. 1.]" — exact match to the code
  comment ("repealed by St. 2016, c. 36").
- **Spot-checked 6 additional `CHAPTER_TITLES` entries** beyond the two the prior round
  already corrected (127, 62C) and the 234 repeal note: c. 130 "Marine Fish and
  Fisheries," c. 94G "Regulation of the Use and Distribution of Marijuana Not Medically
  Prescribed," c. 90C "Procedure for Motor Vehicle Offenses," c. 118E "Division of
  Medical Assistance" — all four fetched from malegislature.gov and match verbatim
  (case-insensitive). No drift since the 6c877bd verification pass; `git diff 6c877bd
  HEAD -- src/ui/chapterModel.ts` shows only the MISCODED_TOKENS/269C addition, no
  title-table edits.
- **Miscoded-token rationale** (258 -> 258E harassment prevention orders, 279C -> c.
  279 §25, 269C -> c. 269 §10): internal SCDAO-data claims, not independently
  checkable against a public source; this is exactly the kind of claim the project's
  own data work already substantiates and is out of scope for an external hostile
  read.

**Flag (Minor, not gating).** `SEVERITY_HEADER`'s first paragraph reads: "...the
Massachusetts Sentencing Commission's Felony and Misdemeanor Master Crime List
(February 2026 edition)..." linking to `https://www.mass.gov/doc/master-crime-list`.
I could not confirm the "February 2026" date. The live URL 403s to every fetch method
tried (WebFetch, curl with browser UA, curl with a referer) — consistent with the
mass.gov bot-blocking already logged in this repo's CLAUDE.md. The closest available
evidence, a Wayback Machine capture from 2026-06-09 of that same URL, shows the
underlying Drupal media entity's `entityTitle`/`entityName` as literally **"Master
Crime List 2015"** (org tag "Massachusetts Sentencing Commission," confirming it's the
right document family), with no "February" or "edition" text anywhere in the captured
HTML. This is not proof the claim is wrong: mass.gov commonly swaps a document's PDF
content in place while leaving the media entity's original upload name untouched, and
WebSearch was unavailable to cross-check further (session search budget exhausted
before I reached this). Flagging as a "verify when mass.gov is reachable" item rather
than a confirmed defect — the evidence is real but circumstantial, and the claim may
well be correct.

## Summary

- Checks run: 20 (5 numbers + 5 state + 5 UX + content skim)
- Checks passed: 20/20
- Critical/Important findings: **0**
- Minor findings: 1 (Master Crime List "February 2026 edition" date, unconfirmed —
  see above)
- Console: clean throughout

**Gate: PASS.** No Critical or Important findings. The loop does not need to reopen.
