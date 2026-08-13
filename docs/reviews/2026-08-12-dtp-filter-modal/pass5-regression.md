# Pass 5 of 5 — Regression review (fresh reviewer)

Branch: `dtp-filter-modal`, forked from `master` at `7a38bbc`. Reviewed at
branch tip `fa91677` ("DTP modal: content facts verified against sources").

## Summary table

| # | Check | Result |
|---|-------|--------|
| 1 | `npm run test` / `npm run build` | test: 62/62 pass **in the dirty working tree only**; **fails 2/62 on a clean checkout of this exact commit**. build: clean. |
| 2 | Full branch diff read end-to-end | Clean. Nothing unrelated to the DTP feature smuggled in. Rebaseline commit's numbers match its own rationale doc exactly, but see #1 — the parquet those numbers were baselined against is not committed. |
| 3 | Dead references to the removed MultiSelects path | None found. `dtp_class`/`dtp_review` appear only in the allowed set. |
| 4 | Bundle size vs. master | +2.60 kB gzip JS, +0.20 kB gzip CSS. Well under the 15 kB flag threshold. |
| 5 | Other filters still work (Court, Outcome class, date range, custom grouping) | All four confirmed working live. |
| 6 | localStorage schema | Untouched by the diff, as expected. |
| 7 | URL state round-trip for DTP filters | Verified by code inspection (DTP filters flow through the identical generic `onSetFilter`/`encodeView`/`decodeView` path already proven live for Court and Outcome class); live click-through evidence for the DTP case specifically was not obtained cleanly due to a browser-tooling contention issue described below. |

**Findings: 1 Critical, 0 Important, 1 Minor.**

**Bottom line:** the DTP modal feature itself is clean, well-scoped, and every
spot-checked filter still works, but the branch as committed does not pass
its own test suite from a fresh checkout — `npm run test` fails 2/62 unless
you have Nasser's locally-rebuilt (and never-committed) `hayden.parquet` sitting
in `public/data/`. That is a Critical finding for a regression pass: this is
exactly the kind of thing that looks green in the working session and red in
CI or for the next person who clones the branch.

---

## 1. `npm run test` / `npm run build`

In the actual working tree (which has an uncommitted, locally-rebuilt
`public/data/hayden.parquet`):

```
Test Files  2 passed (2)
     Tests  62 passed (62)
```

`npm run build`: clean, `tsc -b && vite build`, no errors, one pre-existing
"chunk larger than 500kB" advisory (unrelated to this branch, present on
master too).

**But**: `git status` at the start of this review showed:

```
 M public/data/hayden.parquet
 M public/data/history.parquet
```

`git diff 7a38bbc..HEAD --stat -- public/data/` is **empty** — no commit on
this branch touches these files. So this dirty state is not part of the
branch's own commits; it is Nasser's local working copy diverging from what
is actually committed at `HEAD` (`fa91677`).

To check whether that divergence matters, I built a disposable worktree at
this exact commit (`git worktree add /tmp/p5-headcheck HEAD`, no working-tree
carryover) and ran the suite there:

```
public/data/hayden.parquet:  HEAD = 3,671,290 bytes  |  working tree = 3,670,772 bytes
public/data/history.parquet: HEAD = 16,193,304 bytes  |  working tree = 16,198,265 bytes

npm run test (in the clean worktree):
 ❯ src/engine.test.ts (45 tests | 2 failed)
   × pctDenom lens ... > YY + Conclusively prosecutorial share of ALL dispositions by year
     → expected 3728 to be 3854
   × caseScope: any vs all ... > dispositions 2023, outcome=Office walk-away: any=8,377; all=7,522
     → expected 8378 to be 8377
 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 60 passed (62)
```

These are precisely the two assertions the branch's rebaseline commit
`70c82f1` ("Re-baseline ground truths after the 2026-08-08 classification
fix") changed. Its own report,
`.superpowers/sdd/2026-08-12-dtp-filter-modal/rebaseline-report.md`, states
the starting condition plainly: *"`public/data/hayden.parquet` was already
rebuilt from the corrected CSVs; the hardcoded test numbers were not."* That
rebuild happened locally and was never committed. The test file was updated
to match a parquet that only exists on Nasser's disk, not in git.

**Impact.** Anyone who clones this branch, or any CI system that checks it
out fresh, gets `npm run test` failing 2/62 out of the box. The branch has
been "green" only because the developer's own working directory happened to
already contain the rebuilt data file. This is not a bug in the DTP feature
code — the DTP modal's own logic and its own new tests (`dtpModel.test.ts`,
17/17) are unaffected either way — but it is a real regression against the
basic expectation that a checked-out commit passes its own test suite.

**Recommendation.** Commit the rebuilt `public/data/hayden.parquet` (and
resolve/commit or explain `history.parquet`, see Minor finding below) as
part of this branch, or as a preceding commit it depends on, before this
branch is considered mergeable. Verified from a disposable worktree; the
main working tree was left untouched (dirty files were not touched, per
instructions).

**Severity: Critical.**

## 2. Full branch diff (`7a38bbc..HEAD -- src/ docs/DESIGN.md`)

717-line diff, read in full. Six files touched, all germane to the DTP
filter modal:

- `src/engine.test.ts` — only the rebaselined numbers, a renamed `it` title,
  and two explanatory comments. Diffed against `rebaseline-report.md`'s
  documented change list line by line: `3,728→3,854`, `3,974→4,091`,
  `4,123→4,334`, `3,946→4,398`, `8,378→8,377`, `7,523→7,522`. Matches
  exactly; nothing else in the file changed.
- `src/styles.css` — 21 new lines, all `.dtp-*` classes for the new modal.
  Appended at end of file, no existing rules touched.
- `src/ui/DtpFilterModal.tsx` — new file, the modal component.
- `src/ui/FilterPanel.tsx` — excludes `dtp_class`/`dtp_review` from the
  generic `MultiSelect` loop, adds the "Decline-to-prosecute" summary entry
  and modal mount, both scoped to the `Case` filter group.
- `src/ui/dtpModel.test.ts` / `src/ui/dtpModel.ts` — new pure-logic module
  and its tests (content constants, staging/apply/count-signature helpers).

`docs/DESIGN.md` has no changes on this branch (diff for that path is
empty). Not a defect — nothing in the plan required a DESIGN.md update — but
noting it since the check explicitly asked to include that path.

Nothing touches routing, App.tsx's URL codec, groupings/localStorage code,
CSV export, or any other filter's own logic. The diff is tightly scoped to
the DTP feature.

**Severity: informational (feeds into the Critical finding above, no
additional finding here).**

## 3. Dead references to the removed DTP MultiSelects path

```
grep -rn "dtp_class\|dtp_review" src/ --include="*.ts" --include="*.tsx"
```

All hits fall into the allowed set: `src/contract.ts` (pre-existing column
definitions, unchanged by this branch), `src/ui/dtpModel.ts`,
`src/ui/dtpModel.test.ts`, `src/ui/DtpFilterModal.tsx`,
`src/ui/FilterPanel.tsx` (the exclusion filter and the summary-label /
`dtpOpen` wiring), and `src/engine.test.ts` (pre-existing ground-truth tests
that treat the two columns generically, e.g. `ds.cats.dtp_class.dict.length`
and filter-by-column assertions — these predate the branch and are exactly
the "engine code that treats them as generic columns" case called out in the
task). No stray references, no orphaned CSS classes for a removed
multi-select variant, no leftover imports.

**Severity: none — check passes clean.**

## 4. Bundle size vs. master

Built master (`7a38bbc`) in a disposable worktree (`/tmp/p5-master`,
`npm install` + `npm run build`), compared to the branch build in the actual
working tree (parquet content does not affect JS/CSS bundle size — Vite
copies `public/` assets through unhashed and they don't appear in the
rollup/asset-size summary either way):

| Asset | master (7a38bbc) | branch (fa91677) | delta |
|---|---|---|---|
| JS | 703.21 kB / gzip 205.48 kB | 711.28 kB / gzip 208.08 kB | +8.07 kB raw / **+2.60 kB gzip** |
| CSS | 23.64 kB / gzip 5.35 kB | 24.56 kB / gzip 5.55 kB | +0.92 kB raw / **+0.20 kB gzip** |
| small entry chunk | 2.19 kB / gzip 1.03 kB | 2.19 kB / gzip 1.03 kB | unchanged |
| modules transformed | 699 | 701 | +2 (`DtpFilterModal.tsx`, `dtpModel.ts`) |

Combined gzip delta ≈ 2.8 kB, well under the ~15 kB flag threshold. Both
worktree and repo builds were clean (no errors, same pre-existing >500kB
chunk-size advisory on both). Worktree removed after
(`git worktree remove --force /tmp/p5-master`).

**Severity: none — no finding, numbers reported as requested.**

## 5. Other filters still work

Ran `npm run dev -- --port 5233` (nohup, backgrounded) against the actual
working tree (so against the same rebuilt data the dev workflow normally
uses). Spot-checked via Playwright, on a browser tab pinned to port 5233:

- **Court (Case-group filter, MultiSelect)**: checking "Boston Municipal
  Court" moved the header count from **161,134 → 35,635** of 200,630 rows;
  unchecking it restored 161,134. Confirmed via `location.href` containing
  the base64-encoded `court` filter and via the header stat text.
- **Outcome class (Outcome-group filter, MultiSelect)**: checking "Office
  walk-away" moved the count from **161,134 → 52,865**; unchecking restored
  it.
- **Date range**: setting "Date from" to `2023-01-01` moved the count from
  **161,134 → 123,735** and shifted the chart's x-axis start to `2023-03`;
  the URL hash updated to include `dateFrom`.
- **Custom grouping**: selecting "Custom: Disposition family (example — edit
  me)" as the X axis rebuilt the chart (heading changed to "Charges by
  Custom: Disposition family...", 123,735 rows preserved from the active
  date filter, no error in the page), and the URL hash updated to
  `x.kind=grouping, groupingId=preset_disposition_family`.
- **DTP modal itself** (new component): opened correctly from the "Case"
  group's "Decline-to-prosecute" entry, rendered live per-category counts
  that match engine.test.ts's own ground truth (modal showed "On the decline
  list — 39,106 charges" against the unfiltered 161,134-row view; `dtp_class
  YY = 39,106` is the exact figure documented in the comment at
  `engine.test.ts:758`). Strong corroborating evidence the modal's
  `aggregate()` wiring is correct.

**Tooling caveat (process note, not a product finding).** Another Pass-5
reviewer was concurrently using the same shared Playwright MCP browser
instance on port 5199. The "current tab" pointer for `browser_evaluate` /
`browser_snapshot` calls was not reliably pinned by tab index or by an
explicit `browser_tabs select` — it flipped to the other reviewer's tab
under contention at least twice mid-sequence. On one occasion this caused a
`browser_evaluate` call intended for my own tab to execute against the other
reviewer's tab instead: it toggled their "On the decline list" checkbox in
their own open DTP modal. I caught this from the returned `location.href`
in the same tool response, immediately re-ran the identical evaluate to
toggle it back off, and confirmed via a follow-up `location.href` read that
it was restored to unchecked and that I never touched anything else in
their session (no other clicks landed on their tab; the only other
cross-tab event was a read-only `browser_snapshot` picking up their page
by accident, which changes nothing). Given this, I did not force a further
live click-through for the DTP modal's "Apply → reload → filters survive"
path, to avoid further risk to the other reviewer's evidence, and verified
check #7 (below) by code reading instead, which is arguably the more
rigorous method anyway.

Dev server killed after (`lsof -ti tcp:5233 | xargs kill`; confirmed the
process is gone). My dedicated browser tab was closed via `browser_tabs
close`; the other reviewer's tabs (indices 0 and 1, port 5199) were left
untouched.

**Severity: none — all four spot-checked filters and the modal itself work
correctly.**

## 6. localStorage migrations

```
grep -rn "localStorage" src/
```

Hits: `src/contract.ts` (doc comment), `src/App.tsx` (comment), `src/ui/AboutModal.tsx`
and `src/ui/CategoryBuilder.tsx` (user-facing copy), `src/ui/theme.ts`,
`src/engine/groupings.ts` (the actual grouping-persistence schema). None of
these files appear in the branch diff (`git diff 7a38bbc..HEAD --stat`).
The DTP modal's staged selections live in in-memory `useState`
(`DtpFilterModal.tsx`'s `staged`), not localStorage. No schema touched, as
expected.

**Severity: none.**

## 7. URL state round-trip for DTP filters

Live click-through evidence for this exact path was not obtained cleanly
(see the tooling caveat under #5). Verified by code inspection instead:

- `DtpFilterModal.apply()` calls `onSetFilter(col, payload[col])` for each
  of `dtp_class`/`dtp_review` (`src/ui/DtpFilterModal.tsx`), where
  `onSetFilter` is the exact same prop threaded through to every ordinary
  `MultiSelect`'s `onChange={(vals) => onSetFilter(c.name, vals)}` in
  `FilterPanel.tsx`.
- That prop resolves to `setFilter` in `src/App.tsx:174`, a fully generic
  `(key, values) => ...` that writes `filters[key] = values` (or deletes the
  key if empty) into `view.filters` — no column allowlist, no DTP-specific
  branch.
- `encodeView`/`decodeView` (`src/engine/view.ts`, **not touched by this
  branch**) treat `view.filters` as an arbitrary `Record<string, string[]>`
  via `sanitizeFilters`, which iterates `Object.entries` generically. There
  is no per-column special-casing anywhere in the codec.
- I directly confirmed live, on my own tab, that this exact pipeline
  round-trips through the URL hash for the Court and Outcome-class filters
  (checking a box immediately updated `location.hash` to a new base64url
  token; unchecking reverted it to `#e30`).

Since the DTP modal's `apply()` uses the identical `key → values` contract
as the filters already proven live, and the codec has no special-casing to
diverge on, the DTP case necessarily round-trips the same way. This is
conclusive by construction even without the final live click I wasn't able
to safely obtain.

**Severity: none — verified by code inspection; recommend a follow-up live
smoke test next time the shared browser isn't contended, but this is not
blocking.**

## Minor finding: uncommitted `history.parquet` drift

`public/data/history.parquet` is also locally modified
(16,193,304 → 16,198,265 bytes) but is not discussed anywhere in
`rebaseline-report.md`, and — unlike `hayden.parquet` — its drift does not
currently break any test: the "history dataset (2006-2021) merge" ground
truth test passed in both the dirty working tree and the clean
`7a38bbc..HEAD` worktree. Cause of the drift is not identified by this
review. Worth investigating and either committing or reverting before
`public/data/` is otherwise touched again, so it doesn't silently ship
alongside an unrelated future change.

**Severity: Minor.**
