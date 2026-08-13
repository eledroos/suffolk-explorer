# DTP modal v2 — tabs, browse-the-lists, download, sidebar redesign

2026-08-13. Approved by Nasser with four decisions recorded: charge browser
lives as a third tab in the modal; download is XLSX only; the 2019 memo links
to an external archival copy; the sidebar entry becomes two lines. He added:
update documentation too.

Builds on the shipped v1 (spec `2026-08-12-dtp-filter-modal-design.md`). The
staging semantics, count derivation, normalization, and verified copy are
UNCHANGED unless named below.

## Goals

The v1 modal reads as a wall of text, the two sections force a long scroll,
the copy cites documents a public reader cannot reach, and the sidebar pill
truncates badly. v2 restructures presentation, adds a browsable and
downloadable view of the underlying lists, and links claims to reachable
evidence.

## Non-goals

- No engine changes, no `contract.ts` changes, no new filterable columns.
- No change to staging/apply semantics, `buildCountView`, `countSignature`,
  or normalization. The state machine passed its adversarial review; do not
  reopen it.
- No re-litigation of verified copy facts. Sentences may be reflowed and
  restructured into the new content shape; their factual content changes only
  where this spec says (the caveat's citation).
- The original SCDAO workbook never ships. Only derived files do.

## Tab structure

The modal gains a tab bar under the header: **Decline list** | **Review
status** | **Browse the lists**. Visual pattern: the app's existing
segmented-control styles (the lens toggle in `Sidebar.tsx` / its CSS), so it
reads as native. Tabs 1 and 2 hold the existing card sections. Tab 3 is the
browser (below).

- Staged selection state spans tabs; the footer (Clear both / Cancel / Apply)
  stays visible on tabs 1 and 2 and is hidden on tab 3 (browse is read-only).
- A tab whose section has staged selections shows a count badge (e.g.
  "Decline list · 2").
- Tab state is component-local; the modal always opens on tab 1, except the
  caveat's conflict link opens tab 3 pre-filtered (below).
- Keyboard: the tab bar is a `role="tablist"` with arrow-key navigation and
  `aria-selected`; panels are `role="tabpanel"` with `aria-labelledby`.

## Card redesign (tabs 1 and 2)

Each card keeps checkbox, name, count, one plain sentence. Changes:

1. **Share bar.** Under the count, a thin (3-4px) horizontal bar showing
   count ÷ the section denominator, one accent hue (the app's accent token at
   reduced opacity for the track). Pure CSS width percentage; no library. The
   bar has `aria-hidden="true"` (the count already carries the number).
2. **Structured detail.** The "More" layer becomes typed content:
   - `paragraphs: string[]` rendered as real spaced `<p>`s
   - `facts: {label: string; value: string}[]` rendered as fact chips (small
     bordered tokens, label muted + value emphasized) in a wrapping row above
     the paragraphs. The load-bearing numbers move OUT of prose INTO chips:
     69 charge descriptions / 46 operative / 16 after precedence / 107
     strings / 32 civil motor vehicle / both Not-listed shares. A number may
     appear in a chip or a paragraph, not both.
   - `links: {label: string; href: string; external: boolean}[]` rendered as
     a links row after the paragraphs. External links get
     `target="_blank" rel="noopener noreferrer"` and an external-link glyph.
3. Copy reflow rules: prose sentences may be split across paragraphs and
   shortened where a chip now carries the number, but every factual claim
   that survives must remain byte-traceable to the verified sentence it came
   from or to a chip. The ground-truth doc's claim table is updated to point
   at the new location of each claim (chip or paragraph).

## Links

- **The 2019 memo**: linked on first mention in the header ("published a
  list"). External archival URL; implementation locates a stable public copy
  (Wayback snapshot of the memo PDF or an equivalently stable host), verifies
  it resolves in a real browser, and records the URL and verification date in
  the ground-truth doc. If no stable copy can be verified, the link is
  dropped and the failure recorded; no dead link ships.
- **The caveat**: the sentence citing "the data README" and "a ruling is
  pending" is replaced by evidence the reader can reach: "The worksheet
  itself contains the conflict, and this project's tagging preserves it." +
  a link "See the conflicting rows" that switches to tab 3 with the conflict
  filter on. The README citation and the word "ruling" leave the UI copy.

## Tab 3: Browse the lists

A read-only table of every charge-description string in the classification.

- **Data source**: new static asset `public/data/dtp-lists.json`, generated
  by a new prep script (below), fetched lazily the first time tab 3 opens
  (cached for the session). Not bundled into the JS.
- **Columns**: Charge description | Class (chip: YY/NY/NS/NN) | Review tier
  (chip: Current / Agreed / Rejected, blank when not reviewed) | Charges
  2022-2025 | Charges 2006-2021. Counts right-aligned tabular numerals;
  zero renders as 0, not blank.
- **Search** box filtering on description substring (case-insensitive).
- **Filter chips** above the table: All | On the decline list | Presumption
  against | Case-by-case | Ordinarily prosecuted | Conflicts. "Conflicts"
  shows the strings tagged YY whose review tier is Rejected (the 16). The
  caveat's link opens the tab with Conflicts active.
- Conflict rows also carry a small flag glyph with `title` text.
- A one-line provenance note above the table (what the classification is,
   2020, applied by charge description) and the **Download the lists (XLSX)**
  button, which links the static file below (`download` attribute set).
- Row count is a few hundred; plain rendering, no virtualization. Sorted by
  class (YY, NY, NS, NN) then description; search preserves order.

## The prep script and derived assets

New `scripts/prepare_dtp_lists.py` (module-ownership note: v1 froze
`scripts/` for its two build agents; this spec sanctions the addition — the
script is part of the repo's data-prep family alongside `prepare_data.py`).

- Reads the SCDAO classification workbook from its existing location under
  `../suffolk-package/reference/` (path constant, same style as the other
  prep scripts) and both parquets.
- Mirrors `build_pre2022.py`'s exact normalization (`norm_ws`, uppercase,
  75-char prefix fallback) for both the class tabs and the review tab
  (`load_dtp` / `load_review` logic, including precedence current > agreed >
  disagreed).
- Emits `public/data/dtp-lists.json`:
  `{generated, source_note, rows: [{description, dtp_class, dtp_review, conflict, n_2022_2025, n_2006_2021}]}`
  where counts are FILED-in-window row counts per file whose tagged
  charge-description matches the string under the same logic the build used.
- Emits `public/downloads/suffolk-dtp-lists.xlsx` (openpyxl): a README sheet
  (title, what this is, provenance including that it is a derived file, the
  generation date, the conflict explanation), a combined sheet (same columns
  as the JSON), and one sheet per class tier. Frozen header rows, bold
  headers, sensible column widths, no styling inherited from the original
  workbook.
- **Reconciliation gates, the script fails loudly if violated**: per-class
  sums of per-string counts must equal the parquet's own per-class totals
  for the same window (`dtp_class` group-bys); the conflict-row count must
  equal the parquet cross-tab (YY ∩ review Rejected); the review-tier string
  counts must equal 46 / 107 / 16-after-precedence. Gate results print and
  are recorded in the ground-truth doc.
- Script header documents its venv needs (duckdb, openpyxl) and that its
  outputs are committed, like the parquets.

## Sidebar entry (two-line)

The `dtp-entry` row becomes two lines inside the same button:

- Line 1: chevron + "Decline-to-prosecute" (aligned with sibling rows).
- Line 2 (only when any DTP filter is active): the full `summaryLabel`
  output in smaller muted text, wrapping freely, no truncation, no pill.
- Inactive state shows line 1 with the muted "any" on the right, like
  sibling rows' "all".
- The `.filtered` accent treatment moves to the label or a small dot on
  line 1 (implementation's choice, consistent with existing tokens).
- `truncate()` and the 28-char cap are removed from this call site.

## Content shape change (dtpModel)

`DtpCard.detail: string[]` becomes
`DtpCard.detail: {paragraphs: string[]; facts: {label; value}[]; links?: {label; href; external}[]}`,
and `DTP_HEADER` gains the same shape. Existing verified sentences are
redistributed per the card-redesign rules. Unknown-value bare cards render
with empty detail as today. Tests updated to assert the new shape, that
every fact chip value is non-empty, and that no paragraph repeats a chip's
number.

## Documentation (explicitly requested)

- `DESIGN.md`: feature entry 10 rewritten for v2 (tabs, browse, download,
  sidebar); a new line in the repo-layout/notes section documenting
  `scripts/prepare_dtp_lists.py` and the two derived assets and when to
  regenerate them (after any parquet rebuild or workbook change).
- `docs/specs/dtp-ground-truth-results.md`: new section for the JSON/XLSX
  reconciliation gates and the memo-URL verification record; the claim table
  updated for relocated claims.
- The prep script's own header doc.
- Blog-repo CLAUDE.md Suffolk entry and session memory updated at close
  (outside this repo's commits).

## Verification, scaled to what changed

1. **Numbers**: the reconciliation gates above, plus a reviewer re-deriving
   the JSON's counts for a sample of strings (including a conflict string, a
   zero-count string, and the largest string per class) directly from the
   parquets with duckdb, and opening the XLSX to confirm sheet totals match
   the JSON.
2. **Content**: adversarial pass over ONLY new/changed sentences, chip
   labels, the provenance sheet, and both link targets (memo URL resolves;
   caveat link lands pre-filtered). Relocated claims checked against the
   updated claim table.
3. **UX/accessibility**: tabs keyboard/ARIA per above; browse-tab table at
   390px; download works; share bars invisible to AT; two-line sidebar at
   drawer widths; dark mode.
4. **State**: one scoped check that staging, Apply/Cancel, and the
   chips/URL round-trip are byte-identical in behavior to v1 (the v1 pass-3
   attack list re-run in abbreviated form), since the modal's internal
   structure changed around unchanged logic.
5. **Regression**: suite, build, bundle delta, clean-checkout test (the new
   committed assets must make a fresh clone green), other filters.

Findings loop as in v1: hard gates on 1, 2, 4.

## Commit convention

No AI attribution of any kind in commit messages in this repo.
