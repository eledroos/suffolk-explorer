/**
 * Pure logic for the "Browse the lists" tab (DTP modal v2, tab 3). No React,
 * no fetch: this module only shapes and filters an already-loaded
 * `public/data/dtp-lists.json` payload (schema fixed by Task 1's
 * `scripts/prepare_dtp_lists.py`; see docs/specs/dtp-ground-truth-results.md's
 * "dtp-lists reconciliation" section for how each row's counts were derived
 * and reconciled against the parquets).
 */

export interface DtpListRow {
  description: string;
  dtp_class: string;
  dtp_review: string | null;
  conflict: boolean;
  n_2022_2025: number;
  n_2006_2021: number;
}

export interface DtpListsData {
  generated: string;
  source_note: string;
  rows: DtpListRow[];
}

/** Filter-chip keys. The four class keys are the exact `dtp_class` values
    the JSON carries (also `dtpModel.ts`'s `DTP_CONTENT.dtp_class` card
    values), so a row's chip membership is a plain string match, no separate
    lookup table to keep in sync. */
export type BrowseChipKey =
  | 'all'
  | 'YY (decline list)'
  | 'NY (presumption against)'
  | 'NS (case-by-case)'
  | 'NN (prosecute)'
  | 'conflicts';

export const BROWSE_CHIPS: { key: BrowseChipKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'YY (decline list)', label: 'On the decline list' },
  { key: 'NY (presumption against)', label: 'Presumption against' },
  { key: 'NS (case-by-case)', label: 'Case-by-case' },
  { key: 'NN (prosecute)', label: 'Ordinarily prosecuted' },
  { key: 'conflicts', label: 'Conflicts' },
];

/** Short labels for the review-tier table chip. Deliberately distinct from
    dtpModel.ts's SHORT_REVIEW, which names the longer card headings in the
    filter tabs ("Proposed and agreed, never adopted"); the table column
    needs a shorter word per the task brief. Absent review (not reviewed)
    renders blank, not a "Not reviewed" chip: the review column tracks the
    2020 review's three sections only. */
const REVIEW_CHIP_LABEL: Record<string, string> = {
  'Current list': 'Current',
  'Proposed, agreed (never adopted)': 'Agreed, never adopted',
  'Proposed, disagreed': 'Rejected',
};

export function reviewChipLabel(review: string | null): string {
  if (!review) return '';
  return REVIEW_CHIP_LABEL[review] ?? review;
}

/**
 * Search substring (case-insensitive, on `description`) AND the active
 * filter chip. Preserves the input array's order; never resorts (the JSON
 * ships pre-sorted by class then description, and the table relies on that).
 */
export function filterRows(
  rows: DtpListRow[],
  query: string,
  chip: BrowseChipKey,
): DtpListRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter((r) => {
    if (q && !r.description.toLowerCase().includes(q)) return false;
    if (chip === 'conflicts') return r.conflict;
    if (chip !== 'all' && r.dtp_class !== chip) return false;
    return true;
  });
}
