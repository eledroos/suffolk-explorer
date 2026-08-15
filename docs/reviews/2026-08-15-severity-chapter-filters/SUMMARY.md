# Severity + statute-chapter filters — review record

Built overnight 2026-08-15 on Nasser's direction ("Build #1 and #2 ...
many rounds of adversarially reviewing the results"). Spec:
`docs/specs/2026-08-15-severity-chapter-filters-design.md`. Plan:
`docs/plans/2026-08-15-severity-chapter-filters.md`. 15 commits,
master..severity-chapter-filters.

## Build pipeline

Data layer (both parquets gain severity_class and statute_chapter, prep
gates recount independently) built by the controller; UI built
subagent-driven in three tasks (models, modals, integration), each with an
independent task review; three fix rounds inside the task loop, each with
a scoped re-review.

## Adversarial rounds

- **Round 1** (`round1-*.md`): numbers ~140 live-DOM-vs-duckdb comparisons,
  0 mismatches. State machine 16/16. Content 37 holds / 2 fails (dead
  mass.gov URL; links emitted for miscoded chapter tokens) — fixed
  (9985807). UX 3 fails (chapter search focus; 390px row grid; Escape in
  search) — fixed (f3c20f4).
- **Round 2** (`round2-*.md`): content re-verified both fixes live plus one
  new minor (misdemeanor blurb overclaimed; fixed fe87265). UX full re-run:
  round-1 fixes held; found Escape bubbling closed the drawer too — fixed
  (7ceda50); two native-`<dialog>` focus issues adjudicated pre-existing
  Modal.tsx behavior shared with the DTP modal, parked (below). State
  15/15. Numbers spot-check 10/10.
- **Round 3** (`round3-confirmation.md`): fresh-eyes sweep across all four
  dimensions, 20/20, zero findings. Gate passed.
- **Design pass** (`design-pass-notes.md`): 8 refinements under the repo's
  impeccable skill (denominator lines, row alignment, count typography,
  transition consistency); da7b61b.
- **Chapter titles** (`chapter-title-verification.md`): all 46 titles
  fetched against malegislature.gov; 2 corrected to official wording
  (c. 127, c. 62C); GoTo URL pattern confirmed for every lettered chapter.
- **Regression**: 131/131 tests; clean checkout of the branch installs,
  tests, and builds green; bundle delta +12 KB over master.
- **Final whole-branch review**: BLOCKED on one finding — the history
  dataset's token 369 (one 1971 charge) shipped a dead link because the
  miscoded-token denylist did not generalize. Fixed by inverting to an
  allowlist (84863c2): every linked token was fetched and confirmed on
  2026-08-15; unverified tokens (including future data) render without a
  link. Re-cleared for merge after the fix.

## Adjudications that shape the feature

- History rows carry the explicit severity value "Not graded (pre-2022)"
  rather than nulls, so severity charts and filters cannot silently drop
  1.09M rows.
- The 786-row 13M(b) citation contradiction grades Misdemeanor by the
  base-offense convention (see the assembled README, limitation 8).
- Chapter tokens 258 / 279C / 269C / 369 get no title and no link: SCDAO
  truncations and miscodings, documented in chapterModel.ts.
- "February 2026 edition" claim verified by loading the live PDF's title
  page in a real browser (round 2); a round-3 Wayback doubt was
  adjudicated against that direct observation.

## Parked for Nasser (none block the merge)

1. Native-`<dialog>` tab-wrap escapes to the page on alternate opens, and
   backdrop-click dismissal drops focus to body. Both reproduce on the
   DTP modal on master: Modal.tsx-level, pre-existing. Proposal: a small
   focus-trap/focus-return handler in Modal.tsx, done as its own reviewed
   change since it touches every modal.
2. DTP Browse-tab search has the same first-Escape-clears-query quirk the
   chapter modal fixed; harmless (no drawer leak) but inconsistent.
3. History-only chapter tokens that RESOLVE but were never content-checked
   against their charges (28A, 64F, 111B, ...) could in principle be
   258-style truncations pointing at the wrong real chapter. The allowlist
   guarantees no dead links; it cannot guarantee semantic correctness for
   those rare tokens. A content audit is recorded as follow-up.
4. crime_type demotion recommendation (case-inherited, not charge-level)
   awaits Nasser's call, per the spec's flagged question.
5. Production push: not done; merge is local only.
