# SDD ledger — plan: docs/plans/2026-08-13-dtp-modal-v2.md
Task 1: implementer DONE (commit 555d02e; all 9 gates PASS; found spec conflation: conflict strings = 10 (YY ∩ Rejected), not 16 (tier size); 2,393 charges unaffected; carry to Tasks 3/4 copy)
Task 1: fix round 1/5 (1 addressed — prefix-index divergence documented in-script; commit 50666de; diff verified comments-only, no scoped re-review needed beyond controller check)
Task 1: minor (deferred): XLSX About sheet references "Conflicts rows" but data sheets carry no conflict column (brief capped columns deliberately)
Task 1: complete (commits 555d02e..50666de, review clean; SPEC CORRECTION: conflicts = 10 strings not 16)
Task 2: implementer DONE (commit daf9419; DtpCard.detail restructured to {paragraphs,facts,links?}; 11 chips per brief; DTP_CAVEAT->{text,conflictLinkLabel}; MEMO_URL=null added; test 68/68, build clean; claim table updated with new "Content relocation (v2 Task 2)" section)
Task 2: deviation (approved by necessity, flagged in report): also edited DtpFilterModal.tsx (4 minimal compile-fix lines only, no redesign) since the brief's own "build clean" gate otherwise fails against Task 3's unmigrated consumer file
Task 2: minor (deferred): YY card's own "Caveat:" paragraph still says "a ruling is pending"; brief Step 2 scoped the README/ruling removal to DTP_CAVEAT only, left as-is, flagged for a later task
Task 2: implementer DONE (commit daf9419; 21/21 claims traced through reflow; 4 minimal compile fixes in modal disclosed)
Task 2: minor (deferred to Task 3): agreed-card plain repeats "76" now also in chip; reflow plain to drop the number
Task 2: note for Task 3: YY card paragraph still says "a ruling is pending" — replace citation with the Browse-tab evidence route during modal rebuild
Task 2: complete (commit daf9419, review clean)
Task 3: implementer DONE (tabs role=tablist with ArrowLeft/Right nav, cards v2 with share bar/chips/links, caveat conflict-link wired to setTab('browse')+browseConflicts flag reset-on-leave, two-line sidebar entry; MEMO_URL set to verified Wayback capture of the 2019 memo PDF; ledger items A/B/C all applied; test 68/68, build clean)
Task 3: memo URL verified 2026-08-13 in a real Playwright browser (web.archive.org/web/20190326183822 capture renders the PDF, 66 pages); recorded in dtp-ground-truth-results.md
Task 3: note for Task 4: tab 3 currently a placeholder `<p>` inside DtpFilterModal.tsx's `tab === 'browse'` block, along with the reset-on-leave and console.log effects; replace the whole block with `<DtpBrowseTab conflictsOnly={browseConflicts} onConsumedConflicts={...} />` per its own brief's interface, not the paraphrased BrowseTab/active/openConflicts names in the task-3 prompt's Interfaces summary
Task 3: complete (review clean, no blocking concerns)
Task 3: implementer DONE (commit 1bdc6a3; memo URL verified live from the fact-check dossier's Wayback capture; ledger items A/B/C applied; icons.tsx addition judged minimal)
Task 3: fix round 1/5 (doc back-propagation, commit 53cd00b, controller-verified doc-only)
Task 3: complete (commits 1bdc6a3..53cd00b, review clean)
Task 4: implementer DONE (commit 00b9541; brief's "1,299 rows" was controller typo, actual 1,300; conflicts derived not hardcoded)
Task 4: fix round 1/5 (1 addressed — @types/node frozen-file violation swapped for local .d.ts shim, reviewer had pre-verified the alternative; commit 6f96336)
Task 4: RULING: "Agreed, never adopted" chip label sanctioned over spec's literal "Agreed" (clearer, matches card name)
Task 4: minor (deferred): tab-1/2 unchanged-rendering claim lacked post-change screenshot; reviewer verified safety by CSS static analysis
Task 4: complete (commits 00b9541..6f96336, review clean)
Task 5: complete (commit 592ecec; DESIGN.md entry 11 = DTP modal v2, prep pipeline documented; ground-truth sections verified present)
Task 6: adversarial passes begin — numbers/content/regression parallel (distinct ports + href discipline), then state/UX serial
Task 6: numbers pass CLEAN (0 findings; 1,300-row independent rebuild matched field-for-field; live counts verified under filter)
Task 6: regression pass CLEAN except lockfile crumb (fixed R10); bundle +2.38 kB gzip; clean-checkout gate PASS
Task 6: content pass 2C/9I/5M -> fix wave commits aa5b3fc + 74b87e9 (14 applied) -> re-review found 2 new Important label errors (NB1/NB2) + 3 minor -> round 2 commit 3566bd4 (4 applied, NB3 deferred by ruling)
Task 6: state pass CLEAN (12/12 attacks incl. cross-tab staging, Apply-from-tab-2, caveat deep-link Cancel)
Task 6: UX pass dispatched on fixed code
Task 6: UX fix wave — waived: search-field double-Esc is native input behavior, waived
Task 6: UX fix wave — waived: phantom body tab stop is the v1-waived Chromium quirk, unchanged
Task 6: UX pass 0C/3I/2M -> fix commit 75f8879 (badge spacing, deep-link focus, paragraph rhythm incl. Nasser's live request); v1's three cosmetic carryovers confirmed resolved
Task 6: complete (content closed round 2 zero new breakage; numbers/state/regression clean; residuals for final triage: orphan string fragment in caveat literal, Rejected-card "noted above" direction, NB3/M5/M1-browse deferred by ruling)
Final review: MERGEABLE; 4 one-liners fixed (commit f3c3f63), scoped re-review all ADDRESSED, 84/84
