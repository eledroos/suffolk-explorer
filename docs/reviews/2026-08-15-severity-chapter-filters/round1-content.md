# Hostile-reader content review — severity/chapter filters
Branch `severity-chapter-filters`, repo `2026-08-03 Suffolk DA/data/suffolk-explorer`.
Reviewer stance: lawyer for whoever the data embarrasses. Almost right is wrong.

Ground sources checked live:
- `data/assembled/README.md` (severity section, cols; limitation 8)
- `data/assembled/severity/reviews-2026-08-14/README.md`
- `data/assembled/severity/severity-rulings.csv`
- `data/assembled/hayden-era-charges-2022-2025.csv` / `pre-2022-composite.csv` via duckdb
- malegislature.gov Ch.274 §1, Ch.90C §1, Ch.234, Ch.258/258E, Ch.279/279C, Ch.269C (curl + live Chrome — curl alone 403s on mass.gov, so mass.gov was checked in a real Chrome tab instead of Wayback, which had no snapshot)
- `scripts/prepare_data.py`, `scripts/prepare_history.py`, `src/ui/filterEntries.ts`, `src/engine/notices.ts`, `src/ui/FilterPanel.tsx`, `docs/specs/severity-chapter-ground-truth.py`

**Note on scope**: the brief says `docs/DESIGN.md`; the actual file is `DESIGN.md` at repo root (no `docs/` prefix). Reviewed that file, entry 12.

---

## src/ui/severityModel.ts

### SEVERITY_CARDS

**Felony blurb** — "Crimes punishable by imprisonment in state prison."
HOLDS. G.L. c.274 §1 live text: "A crime punishable by death or imprisonment in the state prison is a felony." Dropping "death" doesn't change any real-world classification (Massachusetts has no operative death penalty), so this is not misleading.

**Felony detail** — "A charge that pleads no repeat-offense enhancement is graded as the base offense; repeat-offense charges (2nd, 3rd, subsequent) are graded at their pleaded tier."
HOLDS. Matches README: "The base-offense convention: a charge that does not plead an enhancement (SUBSQ/2ND/3RD...) is graded as the base offense." The 786-row 13M(b) edge case (statute cites the subsequent-offense subsection but the *title* doesn't plead it) doesn't contradict this — it's precisely a case where the enhancement isn't pleaded in the description, so base-offense grading applies as stated.

**Misdemeanor blurb** — "Every other crime; the maximum sentence runs in a house of correction."
HOLDS. c.274 §1: "All other crimes are misdemeanors." HOC-vs-state-prison is the same dividing line the felony blurb states, from the other side.

**Misdemeanor detail, sentence 1** — "Fine-only crimes are misdemeanors too."
HOLDS. Confirmed in `severity-rulings.csv`: e.g. 90/10/A basis reads "c.90 s.10 offenses are crimes penalized by fine under c.90 s.20; no state-prison term, so a misdemeanor under c. 274 s. 1."

**Misdemeanor detail, sentence 2** — "Unlicensed operation of a motor vehicle stays here rather than with the civil infractions because chapter 90C expressly keeps it a crime."
HOLDS. c.90C §1 live text, "Civil motor vehicle infraction" definition: "...excepting: (a) operation of a motor vehicle in violation of the first paragraph of section 10 of chapter 90; (b) a violation of sections 23, 25, or 34J of chapter 90; and (c) any automobile law violation committed by a juvenile..." Unlicensed operation (c.90 §10 first paragraph) is explicitly and by name excepted from civil-infraction status. Exact match.

**Civil infraction blurb** — "Not crimes: civil motor vehicle infractions charged alongside criminal cases."
HOLDS. c.90C §1 defines "civil motor vehicle infraction" as non-criminal by construction (an alternative to prosecution); README: charges "appear in this dataset because they were filed in criminal court, usually next to criminal charges."

**Civil infraction detail, sentence 1** — "Speeding, marked-lanes and similar violations are civil under G.L. c. 90C."
HOLDS. c.90C §1's "automobile law violation" is defined broadly ("any violation of any statute, ordinance, by-law or regulation relating to the operation or control of motor vehicles"), not limited to c.90, so it reaches c.89 marked-lanes violations too. Confirmed against the data itself: `severity_source='civil-star'` rows include literal charge text "MARKED LANES VIOLATION * c89 §4A" (2,339 rows) and "SPEEDING * c90 §17" (1,762 rows) — SCDAO's own asterisk marker on exactly these charges.

**Civil infraction detail, sentence 2** — "They appear in this dataset because they were filed in criminal court, usually next to criminal charges."
HOLDS. Near-verbatim match to README's own sentence.

**Civil infraction detail, sentence 3** — "Nearly all carry SCDAO's own civil-infraction marker in the charge text; the rest were graded civil by statute."
HOLDS, with a number worth having on hand: computed via duckdb, of 20,101 Civil infraction rows, 18,524 (92.16%) are `severity_source='civil-star'` and the remaining 1,577 (7.84%) are `severity_source='ruling'` — and every sampled civil-infraction ruling in `severity-rulings.csv` cites a specific statute (c.90C s.1 for open container, c.90 s.17/c.90C for speeding, c.94G s.13(d) for marijuana in a vehicle, etc.), confirming "graded civil by statute." 92% is a defensible reading of "nearly all," but note the true figure for anyone who wants to cite it precisely.

**Unclassified blurb** — "Charges the grading declined to guess."
HOLDS. Matches the project's own stated philosophy ("Rather than guess...") and multiple rulings whose basis is literally "not determinable."

**Unclassified detail** — "Three families: offenses graded by an underlying crime the charge does not name (attempts, conspiracies, fugitive-from-justice holds, failures to appear); pre-2018 charge language whose dollar amount straddles today's felony line; and catch-all codes with no identifiable statute."
HOLDS. README limitation 8 names exactly two of these ("658 rows still charged in pre-2018 '$250' language..."; "contingent offenses (bare attempt, conspiracy, fugitive-from-justice holds, fail-to-appear) are Unclassified because their grade depends on an underlying offense the charge does not name"). The third family is confirmed by `severity-rulings.csv`, where multiple CMR/catch-all codes (777777, 540CMR1804, 323CMR403, etc.) carry the basis "regulatory-code violation; criminal or civil status depends on the enabling statute, which the charge does not identify," plus 174 rows with `severity_source='none'` (no MCL match at all). 2,631 ruling + 174 none = 2,805 total Unclassified, tying out exactly.

**Not graded (pre-2022) blurb** — "The 2006-2021 dataset is not graded."
HOLDS.

**Not graded (pre-2022) detail, sentence 1** — "The crime list states current law, and the law moved: larceny's felony line rose from $250 to $1,200 in 2018, and offenses have been created since."
HOLDS, with a soft note. README: "...(the larceny felony threshold moved from $250 to $1,200 in 2018, marijuana decriminalized, offenses created since)." The card compresses this to two clauses and drops the marijuana example; the dollar figures and year are exact matches. The dangling "since" (since 2018? since 2006?) is mildly ambiguous on a strict read, but it doesn't misstate anything checkable and there's no adversarial angle here (this describes generic legal drift, not anyone's conduct) — not a FAILS, just worth tightening if there's a future copy pass.

**Not graded (pre-2022) detail, sentence 2** — "Grading 2006-2021 charges needs the law as it stood at charging, which this project has not done."
HOLDS. Matches README: "Grading it needs charge-time law, a separate task."

**Not graded (pre-2022) detail, sentence 3** — "Rather than guess, these rows are labeled Not graded."
HOLDS. The shorthand "Not graded" (vs. the full `SEVERITY_HISTORY_VALUE` "Not graded (pre-2022)") is unambiguous in context since it sits directly under the card whose own name is the full string.

### SEVERITY_HEADER

**Paragraph 1** — "Severity is graded from the Massachusetts Sentencing Commission's Felony and Misdemeanor Master Crime List (February 2026 edition), applied to each charge's statute code and charge text."
HOLDS. mass.gov's own search index describes the actual document as "Felony and Misdemeanor Master Crime List by M.G.L. Reference. Advisory Sentencing Guidelines. February 2026" — title and edition match exactly. "statute code and charge text" matches the four `severity_source` rules in the README (chapter/section match, cited-statute-plus-tier match, hand ruling, civil-star text marker).

**Paragraph 2** — "The dividing line is where the sentence can be served: a crime punishable by imprisonment in state prison is a felony (G.L. c. 274 § 1); every other crime is a misdemeanor."
HOLDS. Verified verbatim against the live statute (see Felony blurb above).

**Link 1** — label "The Master Crime List (mass.gov)", href `https://www.mass.gov/lists/sentencing-commission-master-crime-list`
**FAILS.** This is a dead link. Confirmed by loading it in a real, logged-in Chrome tab (not just the WebFetch tool, which 403s on mass.gov generally — a plain `curl` to the same URL also 403s, but that's Akamai bot-blocking curl, not evidence either way about the page itself): the page renders mass.gov's own 404 template, title "Not found | Mass.gov," body "404 OOPS We can't find that page." The Wayback Machine has no snapshot of this URL at all (`archive.org/wayback/available` returns an empty `archived_snapshots`), so there's no live fallback either — the link has likely never resolved at this path, or was never live long enough to be crawled.
**Replacement:** point the href at `https://www.mass.gov/doc/master-crime-list`. Confirmed live: title "Master Crime List 2015 | Mass.gov" (stale `<title>` tag, ignore it), page body reads "Master Crime List / Open PDF file, 3.35 MB, Master Crime List (PDF 3.35 MB) / LAST UPDATED: 2026-03-30 / CONTRIBUTING ORGANIZATIONS Massachusetts Sentencing Commission, Massachusetts Court System" — this is the actual February 2026 PDF the header paragraph describes. Keep the existing label text ("The Master Crime List (mass.gov)"); only the href needs to change.

**Link 2** — label "G.L. c. 274 § 1", href `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=274`
HOLDS. Resolves (302) to the real Chapter 274 page; label matches destination.

### SEVERITY_FOOTNOTE_NO_HISTORY
"The 2006-2021 dataset is not graded for severity; turn on \"Include 2006-2021\" to see it listed here."
HOLDS. `src/ui/Sidebar.tsx:128` — the toggle's actual on-screen label is the literal string `Include 2006-2021`. Exact match.

---

## src/ui/chapterModel.ts

**CHAPTER_PROVENANCE** — "Chapter parsed from each charge's statute code. Charges whose code carries no chapter (catch-all and legacy codes) are grouped under \"No statute code\"."
HOLDS. Matches both `scripts/prepare_data.py` and `scripts/prepare_history.py`: `df["statute_chapter"] = ("c. " + chap).fillna("No statute code")`, with a build-time gate (`GATE FAIL: No-statute-code recount ...`) that gets its own independent recount script in `docs/specs/severity-chapter-ground-truth.py`.

**File header comment** — "c. 258 and c. 279C are deliberately absent: SCDAO truncates 258E to 258 and miscodes 279 as 279C, so a real chapter title there would mislead."
HOLDS as literally written, and the underlying facts are strongly confirmed:
- Chapter 258 is real and is "CLAIMS AND INDEMNITY PROCEDURE FOR THE COMMONWEALTH, ITS MUNICIPALITIES, COUNTIES AND DISTRICTS AND THE OFFICERS AND EMPLOYEES THEREOF" (Mass. Tort Claims Act) — nothing to do with the actual charges. Confirmed in the assembled data: 625 rows carry `charge_code='258/9'`, description "HARASSMENT PREVENTION ORDER, VIOLATE c258 §9" — a real c.258E offense that SCDAO's own code drops the "E" from.
- Chapter 279C does not exist ("Chapter does not exist" on malegislature.gov, confirmed live). Real chapter 279 is "JUDGMENT AND EXECUTION." Confirmed in the data: 20 rows carry `charge_code='279C/25'`, description "HABITUAL OFFENDER c279 §25" — SCDAO's own code appends a stray "C" that doesn't belong.
This comment is accurate about *why the title is withheld*. **But see the FAILS below** — the same problem is not withheld from the link, only the title, so the mitigation this comment describes is incomplete for the reader who clicks through. (Filed against `ChapterFilterModal.tsx`'s link rendering, not against this sentence.)

**Inline comment on `'234': 'Juries'`** — "c. 234 (Juries) was repealed by St. 2016, c. 36; the title and link below remain valid for historical charges filed while it was in force."
HOLDS. malegislature.gov, live: "Chapter 234: JURIES / [Repealed, 2016, 36, Sec. 1.]" — exact match on the repeal citation.

**Spot-checked 8 CHAPTER_TITLES entries for surrounding claims (not the titles themselves, per instructions):** 234, 258 (absent), 279C (absent), 94G, 90C, 90D, 22E, 140D. Beyond the two checks above, I resolved the malegislature.gov `GoTo` link for **all 46** titled tokens via curl: every one 302-redirects to a real chapter page (zero "Chapter does not exist" hits), so none of the 46 titled entries carry a dead link. HOLDS across the titled set.

**Bonus finding while probing the 258/279C rationale — not a titled entry, but same defect class**: `charge_code='269C/10'`, description "ARMED CAREER CRIMINAL c269 §10" (2 rows, pre-2022 file only). Chapter 269C also does not exist on malegislature.gov ("Chapter does not exist," confirmed live) and real chapter 269 is "Crimes Against Public Peace." This is a third instance of the exact truncation pattern the header comment names for 258/279C, just not mentioned there — evidence the fix needs to be general rather than a two-item denylist.

---

## src/engine/coverage.ts — `severity-excludes-history` entry

**short** — "Severity filter excludes 2006-2021"
HOLDS. Concise, scoped, no bare numbers needing a noun.

**detail, sentence 1** — "The pre-2022 dataset is not graded for severity, so an active severity filter excludes all of it."
HOLDS. Matches README limitation 8 and the `SEVERITY_CONST`/gate in `prepare_history.py` (`severity_class` is the literal string `"Not graded (pre-2022)"` on every history row, enforced by `GATE FAIL: severity_class constant violated`).

**detail, sentence 2** — "Select \"Not graded (pre-2022)\" in the Severity filter to include those charges."
HOLDS. `SeverityFilterModal.tsx` stages the modal's checkboxes from the *current* filter (`new Set(view.filters[SEVERITY_COL] ?? [])`), so checking this one box is additive to whatever's already selected — the instruction to "select" (not "replace with") is accurate to the actual UI behavior.

Both sentences carry the exact quoted label `"Not graded (pre-2022)"`, which is byte-identical to `SEVERITY_HISTORY_VALUE` and to the card name shown in the modal. No drift.

---

## DESIGN.md (repo root, not `docs/DESIGN.md`), entry 12

**"...two more charge-level columns, `severity_class` (Felony / Misdemeanor / Civil infraction / Unclassified, graded from the Feb 2026 Sentencing Commission Master Crime List, plus the constant `"Not graded (pre-2022)"` on every history row rather than a null...) and `statute_chapter` (...)."**
HOLDS. `scripts/prepare_data.py` gates `severity_class` to exactly `{"Felony", "Misdemeanor", "Civil infraction", "Unclassified"}`; `scripts/prepare_history.py` stamps the exact constant on every row with an equality gate. Both match the sentence precisely.

**"Each gets its own Case-group entry in `FilterPanel.tsx`, reusing the Decline-to-prosecute entry's exact dtp-entry markup and staged Apply/Cancel modal pattern rather than a new one: `SeverityFilterModal.tsx` (card list, `severityModel.ts`) and `ChapterFilterModal.tsx` (searchable, sorted-by-count list with malegislature.gov links, `chapterModel.ts`)."**
HOLDS. `FilterPanel.tsx` lines 219–260 use the identical `<div className="ms dtp-entry">` / `entry-btn` markup for the Severity and Statute chapter entries as the DTP entry. `ChapterFilterModal.tsx` sorts `shown` by `b.count - a.count` and renders a `<input type="search">`; `SeverityFilterModal.tsx` is a static `<ul className="dtp-cards">`. Description matches implementation.

**"Both columns are also excluded from the generic MultiSelect list the same way `dtp_class`/`dtp_review` already were (`filterEntries.ts`'s `isDedicatedModalCol`)."**
HOLDS. `filterEntries.ts`: `DEDICATED_MODAL_COLS = ['dtp_class', 'dtp_review', SEVERITY_COL, CHAPTER_COL]`.

**"...`noticesFor` (`src/engine/notices.ts`, sourced from the `coverage.ts` registry like every other notice) emits an info notice, \"Severity filter excludes 2006-2021,\" whenever a severity filter is active with history on and the selection omits `\"Not graded (pre-2022)\"`: a banner-only `CoverageEntry` (`id: 'severity-excludes-history'`, no `band`) whose `when` clause reads `view.filters.severity_class` and `view.history`, the same pattern `superior-gap` (`when` reads `view.filters['court']`) and `disp-2021-snapshot`/`both-lens-split-rows` (`when` reads `view.history`) already established."**
HOLDS on every checkable clause. `notices.ts` exports `noticesFor`, which is a one-line wrapper around `coverage.ts`'s `noticesFromRegistry` — the DESIGN.md description of the module boundary is accurate even though it doesn't name the wrapped function. The `severity-excludes-history` entry has no `band` key (confirmed). Its `when`: `(view) => { const sel = view.filters['severity_class'] ?? []; return view.history === true && sel.length > 0 && !sel.includes('Not graded (pre-2022)'); }` — reads both `view.filters.severity_class` and `view.history` as claimed. `superior-gap`'s `when` calls `courtInView(view, 'Suffolk Superior Court')`, which reads `view.filters?.['court']`. `disp-2021-snapshot` and `both-lens-split-rows` both use `(view) => view.history === true`. All three comparison points check out.

**Spec/ground-truth file references** — `docs/specs/2026-08-15-severity-chapter-filters-design.md`, `docs/specs/severity-chapter-ground-truth.py` "and its results file, run against the assembled CSVs independently of the parquet build."
HOLDS. All three files exist at the named paths. The ground-truth script's own docstring states: "Runs against the two ASSEMBLED CSVs, not the parquets the app reads, and recomputes both derived columns independently of the two prep scripts" — matching DESIGN.md's characterization exactly, down to "independently."

---

## SeverityFilterModal.tsx hardcoded strings

- `<Modal title="Severity" ...>` — HOLDS.
- Buttons "Clear" / "Cancel" / "Apply", `<summary>More</summary>` — HOLDS, standard controls, no factual content.
- `aria-label={`${count} charges`}` — HOLDS, carries its scoping noun ("charges").
- No empty state exists in this modal (the card list is always 4 or 5 static entries, never zero), so there's nothing to check there.

## ChapterFilterModal.tsx hardcoded strings

- `<Modal title="Statute chapter" ...>` — HOLDS, matches the sidebar entry label in `FilterPanel.tsx` ("Statute chapter").
- `placeholder="Search by chapter number or title"` / `aria-label="Search statute chapters"` — HOLDS. `filterChapters()` matches on both `r.value` (the "265" / "c. 265" number) and the mapped title, so the placeholder accurately describes what's searchable.
- Empty state: `No chapter matches "{query}".` — HOLDS. Grammatical, unambiguous, standard "no results" phrasing.
- Buttons "Clear" / "Cancel" / "Apply" — HOLDS.
- `aria-label={`${row.value} on malegislature.gov`}` and `title="View this chapter on malegislature.gov"` on the external-link icon —
**FAILS for specific rows.** `chapterHref()` in `chapterModel.ts` generates a link for *any* parseable token, with no check against `CHAPTER_TITLES` or against whether the token is even a real chapter. `chapterModel.ts`'s own header comment documents that tokens "258" and "279C" are SCDAO truncation/miscoding artifacts and deliberately omits them from `CHAPTER_TITLES` so no wrong *title* shows — but it does nothing to stop the *link*:
  - The "c. 258" row (625 charges, real offense is c.258E harassment-prevention-order violations) gets a working link to the real but completely unrelated Chapter 258 ("Claims and Indemnity Procedure for the Commonwealth..."). A reader clicking "View this chapter on malegislature.gov" on a harassment-order charge lands on a tort-claims statute.
  - The "c. 279C" row (20 charges, real offense is c.279 §25 habitual-offender) and the "c. 269C" row (2 charges, real offense is c.269 §10 armed career criminal) both link to malegislature.gov's "Chapter does not exist" error page (confirmed live, HTTP 200 with that exact text).
  In all three cases the label "View this chapter on malegislature.gov" / "{value} on malegislature.gov" promises something the click doesn't deliver — either the wrong chapter or no chapter at all.
**Replacement (code-level, since the defect is in link generation, not string text):** guard `chapterHref` (in `src/ui/chapterModel.ts`) so it returns `null` for any token known to be a truncation/miscoding artifact, at minimum `{'258', '279C', '269C'}`, so those rows fall back to the existing "number-only, no icon" rendering already used for untitled tokens — consistent with how the title is already suppressed. A more durable fix would validate every generated token against a real chapter list (or the same 46-entry allowlist `CHAPTER_TITLES` already curates) rather than hand-listing exceptions, since 269C shows the current two-item rationale doesn't cover every case in the data.

---

## Counts

- **HOLDS: 37**
- **FAILS: 2**
- **UNVERIFIABLE: 0**

## Every FAILS, with replacement

1. **`severityModel.ts` `SEVERITY_HEADER.links[0].href`** — `https://www.mass.gov/lists/sentencing-commission-master-crime-list` is a dead link (mass.gov's own 404 page, confirmed in a live browser; no Wayback snapshot exists).
   **Replacement href:** `https://www.mass.gov/doc/master-crime-list` (confirmed live: the actual Feb 2026 "Felony and Misdemeanor Master Crime List" PDF, last updated 2026-03-30, credited to the Massachusetts Sentencing Commission and Massachusetts Court System). Keep the existing label text unchanged.

2. **`ChapterFilterModal.tsx` external-link icon** (`chapterHref()` in `chapterModel.ts`) — for `statute_chapter` values "c. 258" (625 rows), "c. 279C" (20 rows), and "c. 279C" (2 rows), the aria-label/title "…on malegislature.gov" links to either the wrong real chapter (258 → Claims and Indemnity Procedure for the Commonwealth) or a dead "Chapter does not exist" page (279C, 269C).
   **Replacement:** in `chapterHref`, return `null` for tokens `'258'`, `'279C'`, and `'269C'` (mirroring the existing `CHAPTER_TITLES` omission) so those rows render with no link icon, same as any other untitled/unmapped token. Example:
   ```ts
   const KNOWN_BAD_TOKENS = new Set(['258', '279C', '269C']); // SCDAO truncation/miscoding, see file header
   export function chapterHref(value: string): string | null {
     const token = tokenFromValue(value);
     if (token === null || KNOWN_BAD_TOKENS.has(token)) return null;
     return `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=${token}`;
   }
   ```
