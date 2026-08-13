# DTP filter modal — adversarial review, pass 1 of 5 (numbers)

Reviewer had no prior stake in this feature. Goal: find a view under which
the DTP modal's card counts or "of N charges in the current view"
denominators disagree with `aggregate()` over (current lens + date range +
every non-DTP filter, DTP filters ignored).

## Method

1. Re-ran `docs/specs/dtp-ground-truth.py` from a scratch venv
   (`/tmp/dtp-p1`, `uv venv && uv pip install duckdb`) against
   `public/data/hayden.parquet`. Output is byte-identical to the committed
   `docs/specs/dtp-ground-truth-results.md`. The original 8 scenarios still
   pass; nothing to add there.
2. Read `src/engine/aggregate.ts`, `src/engine/merge.ts`, `src/contract.ts`
   (`LENS_INFO`), and `src/ui/dtpModel.ts` (`buildCountView`,
   `countSignature`) end to end before writing any new SQL, specifically to
   work out: what the `all` ("Both") lens does to the window filter, and
   what `view.history` + `mergeDatasets` do to `filed_in_window` /
   `disposed_in_window` semantics.
3. Invented 6 new scenarios (9 through 13 below, one with two sub-cases and
   one with three), computed SQL ground truth first each time, then
   reproduced in the running app (`npm run dev -- --port 5199`) via
   Playwright: navigated directly to a hand-built `#<base64url-json>` view
   hash (bypassing UI clicks for lens/dates/filters, which exercises the
   real `decodeView`/`sanitizeView` path), opened the modal, and read every
   card count and denominator via `dialog.innerText`.
4. Killed the dev server (port 5199) when done. Left a sibling review's dev
   server (port 5233), which was running in the same shared Playwright
   browser instance for a concurrent pass, untouched.

## A pre-existing semantic worth flagging before the scenario table

`LENS_INFO.all.windowFlag` is `null` (`src/contract.ts` line 62): the "Both"
lens applies **no window-flag filter at all**, only the date range against
`filing_date`. And `filed_in_window` / `disposed_in_window` mean different
things in the two parquet files that `history` mode merges:
`hayden.parquet`'s flags mean "in the 2022-2025 window"; `history.parquet`'s
mean "in the 2006-2021 window" (`data/assembled/build_history.py` lines
17-19, confirmed live: `SELECT filed_in_window, count(*) FROM history.parquet
GROUP BY 1` returns 874,107 `True` rows out of 1,092,889, which would be
alarming if read as "filed 2022-2025" but is correct as "filed 2006-2021 per
that file's own layer definition," documented in
`data/assembled/README.md`'s "Layers" table). `mergeDatasets()` in
`src/engine/merge.ts` just concatenates the boolean arrays; it does not
reconcile the two meanings. The net effect, which is consistent and by
design once traced through, not a bug: with history ON, "Filings lens"
counts the union of each row's own file-local `filed_in_window`, i.e.
2006-2021 OR 2022-2025. Scenarios 13a-13c test this directly. It is **not**
specific to the DTP modal (`buildCountView` just forwards to the same
`aggregate()` the main chart uses over the same merged dataset), but it is
exactly the kind of thing that looks like a bug until you read
`build_history.py`, so it earns a flag even though it verified clean.

## Scenario table

All totals below are `dtp_class` card counts unless noted; the paired
`dtp_review` totals are given in prose per scenario and all matched
independently.

| # | Scenario | SQL (YY/NY/NS/NN/Not listed) | SQL total | UI total | Cards match | Denominator match | Verdict |
|---|---|---|---:|---:|---|---|---|
| 1-8 | Committed battery (rerun from scratch) | — | — | — | yes (8/8) | yes | **PASS** |
| 9 | Dispositions lens + disp. date 2022-06-01..2023-05-31 + `disposition_reason`='Dismissed by Commonwealth' | 1526/1237/1400/836/30 | 5,029 | 5,029 | yes | yes | **PASS** |
| 10 | Filings lens + custom grouping on `charge_description` (base column, not `court`), bucket "Top10" = 10 highest-volume descriptions, filter = "Other" (the complement) | 22035/18942/31764/35647/1876 | 110,264 | 110,264 | yes | yes | **PASS** |
| 11 | Filings lens + 3 stacked filters: `court`='Boston Municipal Court' AND `race`='B' AND `case_status`='Closed' | 3360/1376/2469/1962/40 | 9,207 | 9,207 | yes | yes | **PASS** |
| 12a | "Both" lens (`lens='all'`), no filters, no history — windowFlag is `null`, so every row in `hayden.parquet` counts | 48146/34220/57079/59061/2124 | 200,630 | 200,630 | yes | yes | **PASS** |
| 12b | "Both" lens + date range 2024-01-01..2024-12-31 (filters on `filing_date` only, no window flag) | 10666/9030/12059/11716/458 | 43,929 | 43,929 | yes | yes | **PASS** |
| 13a | Filings lens + history ON, no filters — union of each file's *own* `filed_in_window` (2022-2025 for hayden, 2006-2021 for history) | 260987/170537/346966/235918/20833 | 1,035,241 | 1,035,241 | yes | yes | **PASS** |
| 13b | "Both" lens + history ON, no filters — every row, both files, no window check | 319610/189080/437158/281992/65679 | 1,293,519 | 1,293,519 | yes | yes | **PASS** |
| 13c | Dispositions lens + history ON, no filters — union of each file's own `disposed_in_window` | 280315/162817/387161/234036/63458 | 1,127,787 | 1,127,787 | yes | yes | **PASS** |
| bonus | Filings lens, no filters, main view `measure='cases'` — modal must still show charges, not distinct cases | (= scenario 1) | 161,134 | 161,134 | yes | yes | **PASS** — confirms `buildCountView` hardcoding `measure: 'charges'` (`src/ui/dtpModel.ts` line 190) actually holds at runtime, not just in the source |

`dtp_review` totals for 9-13 (Current list / Proposed-agreed / Proposed-disagreed / Not reviewed), all confirmed against independent SQL and all matched the UI exactly:

- 9: 1489 / 1347 / 45 / 2148 = 5,029
- 10: 19617 / 16861 / 2517 / 71269 = 110,264
- 11: 3040 / 1030 / 325 / 4812 = 9,207
- 12a: 44935 / 32498 / 3323 / 119874 = 200,630
- 12b: 9985 / 8147 / 716 / 25081 = 43,929
- 13a: 241847 / 166743 / 20999 / 605652 = 1,035,241
- 13b: 267771 / 181015 / 25675 / 819058 = 1,293,519
- 13c: 231727 / 156834 / 22223 / 717003 = 1,127,787

## Findings

**Critical:** none.

**Important:** none.

**Minor:** none.

No mismatch found across 8 committed scenarios (re-verified) + 6 new
scenarios (9 with 2 sub-checks, 13 with 3 sub-checks) + 1 bonus check, each
checked on both the `dtp_class` and `dtp_review` cards and the shared
denominator. This includes the two combinations flagged in the brief as
most likely to break: the "Both" lens's null-windowFlag semantics, and the
history merge's dual-meaning `filed_in_window`/`disposed_in_window` columns.
Both verified correct once the underlying design was traced through the
engine and build scripts; neither is actually subtle in the code, only in
not having read `build_history.py` and `LENS_INFO` first.

## What I could not test, and why

- **Genuine UI-driven custom-grouping creation.** For scenario 10 I injected
  the grouping directly into `localStorage` (`suffolk-explorer-groupings`,
  matching the exact shape `CategoryBuilder`/`src/engine/groupings.ts`
  already writes) rather than clicking through the Categories panel to build
  it, because doing so for 6 scenarios would have cost more time than it
  bought: the DTP modal's own logic (`aggregate()` over `view.filters`) is
  identical either way, and `CategoryBuilder` is pre-existing UI outside this
  feature's diff. This does not exercise `CategoryBuilder` itself, which is
  covered by the standing dual-review convention on that component's own
  history, not this feature. Confirmed the localStorage write actually took
  by reading it back and by an off-list total (110,264) matching the SQL
  ground truth exactly.
- **Encountered and worked around: hash-only navigation does not reload the
  app.** `page.goto()` to a URL that differs only in the fragment is a
  same-document navigation in Chrome; it does not remount `App.tsx`, so a
  `localStorage` write made after the app's initial mount is invisible to
  the running React state (`userGroupings`) until an actual reload. First
  attempt at scenario 10 silently produced the full-default view (`#e30`)
  because `sanitizeView` correctly stripped a grouping filter it didn't yet
  know about. Not a product bug (verified by reading `sanitizeView` in
  `src/App.tsx` lines 50-84 and confirming the drop was correct given the
  stale in-memory state); fixed the harness by `location.hash = token;
  location.reload()` instead of `page.goto()` for that one case, then
  re-verified.
- **Encountered and worked around: shared Playwright browser across
  concurrent review passes.** This session's dev server (port 5199) and a
  sibling pass's dev server (port 5233) were both open in the same browser
  instance, and the "current" tab pointer moved on its own between tool
  calls (presumably the other pass selecting its own tab). One reading
  (`123,735 of 200,630`) was captured from the wrong tab and would have been
  reported as a Critical mismatch against the `43,929` SQL ground truth for
  scenario 12b had `location.href` not been checked in the same call and
  caught the tab drift. After that, every navigate was followed by an
  explicit `browser_tabs select` immediately before every click/evaluate,
  and every evaluate returned `location.href` alongside the data so a
  mismatch would be self-evident. No other reading showed signs of
  cross-talk, but this is a standing hazard for any pass run concurrently
  with this one in the same browser, and worth knowing about when reading
  the other passes' results too.
- **`caseScope='all'` interaction with the DTP modal.** `aggregate.ts` has a
  separate code path for `measure==='cases' && caseScope==='all'`
  (line 215) that qualifies a case only if every one of its rows passes the
  filters. `buildCountView` always sets `measure: 'charges'`, so this path
  is structurally unreachable from the modal regardless of the main view's
  `caseScope`, confirmed by reading the code rather than by a runtime
  check; a runtime check would be redundant given the hardcoding is
  unconditional.
- **Distinct-people measure, `pct` modes, chart type, granularity.** All are
  overridden or irrelevant per `buildCountView` (`measure`, `pct` hardcoded;
  `x`/`series`/`granularity` don't affect a `charges`-measure aggregate's
  total). Verified by code reading; the bonus `measure='cases'` runtime check
  above is the one member of this family I also confirmed live, since it
  was cheap and directly testable.

## Bottom line

Every scenario tried, including the two the brief specifically flagged as
likely to break (the `all`-lens null window flag and the history-merge
window-flag semantics), matched SQL ground truth exactly on every card and
both denominators. Zero findings.
