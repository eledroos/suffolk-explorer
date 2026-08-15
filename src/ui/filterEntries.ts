/**
 * Pure logic shared by the Case group's dedicated-modal filter entries in
 * FilterPanel.tsx: the existing Decline-to-prosecute entry (dtp_class /
 * dtp_review) and the two entries this module was added for, Severity and
 * Statute chapter. No React.
 */
import { CHAPTER_COL } from './chapterModel';
import { SEVERITY_COL } from './severityModel';

/** Columns that carry a dedicated modal entry in the Case group and must
    never also render in the generic MultiSelect list built from COLUMNS. */
export const DEDICATED_MODAL_COLS: readonly string[] = [
  'dtp_class',
  'dtp_review',
  SEVERITY_COL,
  CHAPTER_COL,
];

/** True when `name` has its own modal entry, so the generic filter list
    must skip it. Extends the pre-existing dtp_class/dtp_review exclusion
    to cover Severity and Statute chapter. */
export function isDedicatedModalCol(name: string): boolean {
  return (DEDICATED_MODAL_COLS as string[]).includes(name);
}

/** A single-column entry (Severity, Statute chapter) is active exactly
    when that column carries at least one selected value. Unlike the DTP
    entry, which is active when either of two columns is non-empty, each
    of these entries owns one column. */
export function singleColEntryActive(
  filters: Record<string, string[] | undefined>,
  col: string,
): boolean {
  return (filters[col]?.length ?? 0) > 0;
}
