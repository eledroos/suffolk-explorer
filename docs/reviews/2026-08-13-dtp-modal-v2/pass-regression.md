# Adversarial review — regression (DTP modal v2), fresh reviewer

Branch: `dtp-modal-v2`, forked from `master` at `3727e67`. Reviewed at branch
tip `592ecec` ("Document DTP modal v2 and the dtp-lists prep pipeline").

## Summary table

| # | Check | Result |
|---|-------|--------|
| 1 | Clean-checkout gate (`git worktree add`, `npm install`, `test`, `build`) | **PASS.** 84/84 tests, clean build, on a fresh worktree with no carryover from the main working tree. |
| 2 | Full branch diff read (`src/`, `DESIGN.md`, `scripts/`); `package.json`/`package-lock.json` unchanged | **PASS on scope** — every file in the diff is germane to the v2 feature, nothing smuggled in. **1 Minor finding** — `package-lock.json` is not byte-identical to `3727e67`; see below. `package.json` itself is identical. |
| 3 | Bundle: `dtp-lists.json` not inlined in JS; gzip delta vs master | **PASS.** Row data confirmed absent from both JS chunks; only static prose (containing the word "TRESPASSING" as an example) triggered the naive grep. JS gzip delta: **+2.38 kB**, CSS gzip delta: **+0.50 kB**. Both well under the 20 kB flag threshold. |
| 4 | Suite integrity: 84/84, no `.only`/`.skip` | **PASS.** 84/84 on the clean worktree; `grep -rn "\.only(\|\.skip("` over `src/**/*.test.ts` and `engine.test.ts` returns nothing. |
| 5 | Browser spot-check (port 5252): non-DTP filter, custom grouping builder, About modal, DTP filter apply, Browse tab | **PASS**, all five. See tooling caveat below — a concurrent adversarial pass (Task 6's numbers/content reviewers) was using the same shared browser on port 5241 and the "current tab" pointer drifted onto their tabs twice mid-sequence. Every claim below is backed by a `location.href` read in the same tool call confirming it landed on my own `:5252` tab; results returned from the wrong tab were discarded, not reported as findings. |
| 6 | localStorage / URL-encoding schema unchanged | **PASS.** `grep -rn "localStorage\|encodeView\|decodeView\|history.pushState\|history.replaceState"` shows hits only in `App.tsx`, `engine/view.ts`, `engine/groupings.ts`, `contract.ts`, `theme.ts`, `CategoryBuilder.tsx`, `AboutModal.tsx`, `engine.test.ts` — none of which appear in `git diff 3727e67..HEAD --stat`. |
| 7 | v1's preserved review record untouched | **PASS.** `git diff 3727e67..HEAD -- docs/reviews/2026-08-12-dtp-filter-modal/` is empty; all six files (`pass1`–`pass5`, `progress.md`) present and unchanged. |

**Findings: 0 Critical, 0 Important, 1 Minor.**

**Bundle delta: JS gzip +2.38 kB (211,900 B branch vs 209,519 B master, measured via `gzip -9` on the built chunks), CSS gzip +0.50 kB. Both far under the 20 kB threshold.**

**Bottom line:** the branch is clean. Fresh checkout installs, tests, and
builds green with only the committed assets; the diff is tightly scoped to
the browse/download tab and its supporting content restructure; the JSON
payload ships as a separate static asset, not inlined; the suite is full
strength at 84/84; every other modal and filter spot-checked still works;
storage/URL schemas and the v1 review record are untouched. The one Minor
finding is a leftover one-line diff in `package-lock.json` from a violation
that was mostly, but not completely, reverted — harmless in practice, worth
a follow-up commit before calling the gate airtight.

---

## 1. Clean-checkout gate

```
git worktree add /tmp/v2-clean HEAD
cd /tmp/v2-clean && npm install --silent && npm run test && npm run build
```

```
 Test Files  3 passed (3)
      Tests  84 passed (84)
```

```
✓ 703 modules transformed.
dist/index.html                   1.50 kB │ gzip:   0.82 kB
dist/assets/index-BINeoMYD.css   27.74 kB │ gzip:   6.07 kB
dist/assets/index-huMfgPFi.js     2.19 kB │ gzip:   1.03 kB
dist/assets/index-DzySnvbv.js   721.71 kB │ gzip: 211.28 kB
✓ built in 1.18s
```

No errors, no warnings beyond the pre-existing >500 kB chunk-size advisory
(present on master too, unrelated to this branch). Worktree removed after
(`git worktree remove --force /tmp/v2-clean`).

**Severity: none — check passes clean.**

## 2. Full branch diff

`git diff 3727e67..HEAD --stat`: 16 files, +12,327/-185. Read in full:

- `DESIGN.md` — entry 11 updated for the three-tab modal, new "Data and
  tooling" section documenting `prepare_dtp_lists.py`. On-topic.
- `docs/specs/dtp-ground-truth-results.md` — new, the reconciliation record
  for the generator script's gates.
- `scripts/prepare_dtp_lists.py` — new, generates the committed JSON/XLSX.
  Read start to finish; mirrors `build_pre2022.py`'s matching logic as its
  own docstrings claim, with one documented, justified divergence (a wider
  75-char prefix index) that the script's own comments explain and defend
  against the parquet's actual baked-in tagging.
- `public/data/dtp-lists.json`, `public/downloads/suffolk-dtp-lists.xlsx` —
  the generated assets themselves (committed, per the project's own
  "recompute, don't quote" / commit-derived-assets convention).
- `src/styles.css` — new `.dtp-*` rules for the tab bar, fact chips, share
  bars, and the browse table; existing `.dtp-entry` sidebar rules reworked
  for the two-line layout. No rules outside the `.dtp-*`/`.entry-*`/`.seg`
  namespaces touched.
- `src/ui/DtpBrowseTab.tsx`, `src/ui/dtpBrowse.ts`, `src/ui/dtpBrowse.test.ts`
  — new, the browse tab's data-fetch/filter logic and its 16 tests.
- `src/ui/DtpFilterModal.tsx` — tabs added (`class`/`review`/`browse`),
  card rendering extended for fact chips and links, memo URL wired as an
  inline link. No changes outside the DTP modal component.
- `src/ui/FilterPanel.tsx` — only the `Case`-group DTP entry button's markup
  (two-line layout, dot indicator instead of a truncating pill). Every other
  filter group's rendering loop is untouched.
- `src/ui/dtpModel.ts`, `src/ui/dtpModel.test.ts` — `DtpCard.detail`
  restructured from `string[]` to `{paragraphs, facts, links?}`; content
  copy updated to move numbers into fact chips. `SHORT_CLASS` exported for
  reuse by the browse tab. No logic outside DTP content/staging touched.
- `src/ui/icons.tsx` — one new icon (`IconExternal`), additive.
- `src/ui/dtp-test-node-shims.d.ts` — new, local type shims for
  `node:fs`/`node:url` in the browse-tab test (see finding below for why
  this file exists).
- `package.json`, `package-lock.json` — see below.

Nothing touches `App.tsx`, `src/engine/*`, `contract.ts`, routing, CSV
export, or any non-DTP filter's rendering path.

### Finding: `package-lock.json` not fully reverted (Minor)

`git diff 3727e67..HEAD -- package.json` is empty — byte-identical.
`git diff 3727e67..HEAD -- package-lock.json` is **not** empty:

```diff
     "": {
       "name": "suffolk-explorer",
       "version": "0.1.0",
+      "license": "MIT",
       "dependencies": {
```

History (`git log -p 3727e67..HEAD -- package-lock.json package.json`)
shows why: commit `00b9541` added `@types/node` as a devDependency (a
frozen-file violation caught in the branch's own Task 4 fix round, per
`.superpowers/sdd/2026-08-13-dtp-modal-v2/progress.md` line 21: "1
addressed — `@types/node` frozen-file violation swapped for local `.d.ts`
shim"). Commit `6f96336` reverted the `@types/node` addition — cleanly, in
both `package.json` and every `@types/node`/`undici-types` block in the
lockfile — and added `dtp-test-node-shims.d.ts` in its place. But the
**first** line `00b9541` added to the lockfile, a `"license": "MIT"` entry
on the root package block (which npm back-fills into the lockfile to match
a field `package.json` has always carried), was never removed. The revert
was 99% complete but missed this one line.

**Impact:** none observed. `package.json` matches `3727e67` exactly, `npm
install` and `npm ci` behave identically either way (the field just
mirrors what `package.json` already declares), and the clean-checkout gate
(#1 above) passed without incident. This is a paperwork gap, not a
functional one — but the task brief's explicit requirement was "UNCHANGED,"
and the lockfile is not.

**Severity: Minor.** Recommend a one-line follow-up commit
(`npm install` with `package.json` untouched will not by itself remove it;
the field would need to be dropped by hand or by pinning npm's
lockfile-metadata behavior) before calling this gate airtight.

## 3. Bundle: JSON inlining and gzip delta

Grepping `dist/assets/*.js` for `"TRESPASSING"` (the check's suggested
needle) returns a hit — but inspection shows it's the **static prose**
in `dtpModel.ts`'s "Not listed" card ("...such as \"TRESPASSING\" where the
worksheet carries \"TRESPASS c. 266 s. 120\"..."), not row data. Re-tested
with strings that only exist in `dtp-lists.json`'s actual rows
(`"B&E FOR MISDEMEANOR"`, `"COCAINE, DISTRIBUTE"`, both from the real
committed file, not the test fixture): zero hits in either JS chunk or
`index.html`. `find dist -iname "dtp-lists.json"` confirms it ships as
`dist/data/dtp-lists.json`, a separate static asset fetched at runtime by
`DtpBrowseTab.tsx`; `dist/downloads/suffolk-dtp-lists.xlsx` likewise.

Gzip delta vs. master, measured precisely with `gzip -9` on the built
chunks (not vite's own rounded display) from disposable worktrees at
`HEAD` and at `master` (`3727e67`, confirmed identical commits):

| Asset | master (`3727e67`) | branch (`592ecec`) | delta |
|---|---|---|---|
| JS (both chunks, gzip) | 209,519 B | 211,900 B | **+2,381 B ≈ +2.38 kB** |
| CSS (gzip, vite-reported) | 5.57 kB | 6.07 kB | +0.50 kB |
| modules transformed | 701 | 703 | +2 |

Well under the 20 kB flag threshold. Both worktree builds clean, same
pre-existing >500 kB chunk-size advisory on both. Worktrees removed after.

**Severity: none — no finding.**

## 4. Suite integrity

```
Test Files  3 passed (3)
     Tests  84 passed (84)
```
(same run as #1, clean worktree.)

```
grep -rn "\.only(\|\.skip(" src/**/*.test.ts src/engine.test.ts
```
returns nothing (exit 1 / no matches).

**Severity: none.**

## 5. Other-surface spot-check (browser, port 5252)

Dev server: `npm run dev -- --port 5252 --strictPort`, backgrounded, from
the repo working tree (already on `dtp-modal-v2`, clean). Killed after
(`lsof -ti :5252 | xargs kill -9`, confirmed gone).

**Tooling caveat, disclosed up front.** A concurrent Task 6 reviewer
(numbers/content passes, per this branch's own `progress.md` line 26,
"adversarial passes begin — numbers/content/regression parallel") was using
the same shared Playwright browser on port 5241. As in the v1 regression
pass's own documented experience with this exact shared-browser setup, the
"current tab" pointer drifted onto their tabs at least twice mid-sequence —
once landing a read (`querySelector` for a dialog title) on their tab, and
once landing two button clicks (`Close`, then `Categories`) on their tab
before I caught it via the returned `location.href` and re-selected my own
tab by index for every subsequent call. No filter checkbox, Apply button,
or any state-mutating/data-affecting control was ever clicked while
mis-landed — only generic modal-open/close toggles, which are non-destructive
UI navigation. I did not attempt further corrective pokes into their tab
afterward, consistent with the v1 precedent's judgment that additional
probing of someone else's live session is more risk than benefit once the
mistake is caught and characterized. My own tab (opened as a dedicated new
tab, index 2, later closed) and its findings below are each confirmed by an
`href` read in the same tool call that produced the result.

Spot-checks, all confirmed on `http://localhost:5252/...`:

- **Non-DTP filter (Court, MultiSelect).** Checking "Boston Municipal
  Court" moved the header count from 161,134 → 35,635 of 200,630; URL hash
  updated to the base64url-encoded `court` filter.
- **Custom grouping builder.** "Categories" button opens the "Custom
  categories" modal with its grouping-builder copy intact.
- **About modal.** "About" button opens "About this data" with its usual
  content, single modal instance in the DOM.
- **DTP filter modal — apply flow.** Opened via the sidebar's
  "Decline-to-prosecute" entry. Checked "On the decline list" (staged;
  modal-open checkbox count read 39,106, matching the card's live count),
  clicked Apply: URL hash became
  `#eyJmaWx0ZXJzIjp7ImR0cF9jbGFzcyI6WyJZWSAoZGVjbGluZSBsaXN0KSJdfX0` (decodes
  to `{"filters":{"dtp_class":["YY (decline list)"]}}`), header count
  dropped to 39,106 of 200,630, sidebar chip text updated to "On the
  decline list · review: any", chart caption updated to "39,106 charge rows
  in view." Chips and chart both changed, as required.
- **Browse the lists tab.** Opened the modal fresh, switched to "Browse the
  lists": table populated with all 1,300 rows fetched from
  `dtp-lists.json` (first row: "B&E FOR MISDEMEANOR c. 266 s. 16A" / "On the
  decline list" / 118), all six filter chips present (All, four classes,
  Conflicts), no error state.

Console: 0 errors, 0 warnings reported for the tab across the session.

**Severity: none — all five spot-checks pass.**

## 6. localStorage / URL-encoding schema

```
grep -rn "localStorage\|encodeView\|decodeView\|URLSearchParams\|history.pushState\|history.replaceState" src/
```

Hits: `App.tsx`, `engine/view.ts`, `engine/groupings.ts`, `contract.ts`
(doc comments), `theme.ts`, `CategoryBuilder.tsx`/`AboutModal.tsx`
(user-facing copy). None of these files appear in
`git diff 3727e67..HEAD --stat`. The DTP modal's own state (`staged`,
`tab`, `browseConflicts`) lives in in-component `useState`, not
localStorage; the browse tab's fetched JSON is cached in a module-level
variable, also not localStorage. No schema touched.

**Severity: none.**

## 7. v1 review record

```
git diff 3727e67..HEAD -- docs/reviews/2026-08-12-dtp-filter-modal/
```
Empty. `ls docs/reviews/2026-08-12-dtp-filter-modal/` still shows all six
files (`pass1-numbers.md` through `pass5-regression.md`, `progress.md`).

**Severity: none.**
