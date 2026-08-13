# SDD ledger — plan: docs/plans/2026-08-12-dtp-filter-modal.md
Task 1: implementer DONE (commit c468287, 10/10 dtpModel tests; smart-quote->ASCII deviation noted)
Interleaved maintenance: engine.test.ts ground truths re-baselined after 2026-08-08 classification fix (commit 70c82f1, duckdb+engine agree on all 8 values, delta traced to case 596471 + Dismissed-WO-Prosecution reclass). Suite 55/55 green.
Task 1: fix round 1/5 (1 addressed, 0 open — apostrophe revert; commit fd164e5)
Task 1: complete (commits c468287..fd164e5, review clean)
Task 2: implementer DONE (commit f121062, 7 new tests, suite 62/62)
Task 2: plan conflict escalated to Nasser — summaryLabel "N of M" denominator blind to unknown values; RULING: drop denominators (his call, recorded 2026-08-12)
Task 2: fix round 1/5 (1 addressed, 0 open — denominators dropped; commit a1807c5)
Task 2: minor (deferred): filter arrays shared by reference in buildCountView/countSignature — harmless under current no-mutation convention
Task 2: minor (deferred): explicit-empty-array filter key vs absent key could differ in countSignature; App.tsx deletes empty keys so unreachable today
Task 2: complete (commits f121062..a1807c5, review clean)
Task 3: implementer DONE (commit e309550; plan bug fixed inline: countSignature missing from import list; CSS tokens --grid/--warn, .btn .btn-primary substituted)
Task 3: fix round 1/5 (1 addressed, 0 open — Cancel button .btn; commit 9d18f49)
Task 3: minor (deferred): section aria-label duplicates the h3 for screen readers; aria-labelledby would avoid double announcement
Task 3: note: public/data/*.parquet modified-uncommitted in working tree since 2026-08-08 classification fix rebuild — predates this feature, needs a commit decision from Nasser
Task 3: complete (commits e309550..9d18f49, review clean)
Task 4: implementer DONE (commit db7c974; real plan gap fixed inline: filterCols leak into "Other" group; 10/10 browser checks, screenshots /tmp/dtp-shots/)
Task 4: minor (deferred): DTP entry lacks IconChevron, ~20px misalignment vs sibling rows
Task 4: minor (deferred): active-filter pill squeezes .ms-label to "Declin-t…" when filter engaged
Task 4: complete (commit db7c974, review clean)
Task 5: implementer DONE (commit f25e068; 8/8 scenarios pass; adaptations documented: real court value, disjoint-date empty view)
Task 5: fix round 1/5 (2 addressed, 0 open — 3 missing dtp_review queries added, false density claim corrected; commit f72614b; re-reviewer re-ran the script, output byte-matches results file)
Task 5: complete (commits f25e068..f72614b, review clean)
Task 6: implementer DONE (commit fa91677; 7 claims verified, 17->16 disagreed strings fixed in copy — precedence reassigns METHAMPHETAMINE string to current list)
Task 6: note: data/assembled/README.md still says "(17)" — stale, outside task scope, fix in blog repo later
Task 6: minor (deferred): results file cites README "line 60", actual 61
Task 6: complete (commit fa91677, review clean)
Task 7: five adversarial passes begin — 1 numbers, 2 content, 3 state machine, 4 UX/a11y, 5 regression; passes 1-3 hard gates
Task 7: NOTE — passes 1 and 5 share the playwright browser; treat unexplained UI mismatches as possible tab interference before fix-looping
Task 7: pass 1 (numbers) CLEAN — 15 scenarios incl. Both-lens null windowFlag and history-merge semantics, 0 findings; caught+neutralized a tab-contention false positive itself
Task 7: pass 2 (content) 3C/7I/5M — YY card described wrong tab (69-string YY tab vs operative 46); workbook is a 2020 SCDAO-internal document (creator Bobby Constantino (SUF)); present-tense office attributions
Task 7: pass 5 (regression) 1C/1M — corrected parquets never committed, clean checkout failed 2/62; history.parquet drift
Task 7: fix wave (commits aefb48e parquets, 1166220 copy rewrite) — 16/17 addressed, M5 deferred by ruling (both numbers correct in scope); clean-worktree 62/62
Task 7: fix-wave concern noted: "expansion never became policy" still an unsourced negative on the card; content re-review will adjudicate
Task 7: pass 3 (state machine) dispatched
Task 7: pass 3 (state machine) CLEAN — 12/12 attacks pass incl. two invented (backdrop-discard, g:-filter preservation); harness trap documented (chained clicks in one evaluate see stale closure; real clicks immune)
Task 7: fix round 2 (commit abf99b5) — I1 verbatim; NB1 partially applied, fixer REJECTED re-reviewer's example as false with measurement: citation-style drift (c. 266 s. 127 vs C266 §127) bridges 16,022/63,108 = 25.4% of unmatched pre-2022 strings
Task 7: round 3 verdict requested from content reviewer; pass 4 (UX/a11y) dispatched
Task 7: round 3 verdict — I1 ADDRESSED, NB1 ADDRESSED (reviewer conceded its example was the same inference-from-absence error; 25.4% derivation reproduced exactly). Content gate CLOSED.
Task 7: minor (deferred): Not-listed card's pre-existing "mostly truncated or rare variants" clause now in mild tension with the measured citation-style finding
Task 7: pass 4 (UX/a11y) CLEAN at C/I — 3 minors: phantom body tab-stop on forward wrap (Chromium native dialog quirk, not app code); aria-label/h3 duplication (reconfirmed); chevron + label-squeeze cosmetics (reconfirmed, unchanged). 3 visual false alarms disproven by pixel sampling, documented.
Task 7: complete (fix commits aefb48e, 1166220, abf99b5; passes 1/3 zero findings; pass 2 closed round 3; pass 5 critical fixed; pass 4 minors await Nasser waiver)
Task 8: complete (commit 853a41a, DESIGN.md feature entry)
Final review: MERGEABLE; 1 Important (SHORT_REVIEW naming) fixed commit 5511eb0, re-review ADDRESSED, 63/63
