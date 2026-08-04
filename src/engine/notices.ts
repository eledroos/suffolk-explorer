/**
 * Data-quality notices, per DESIGN.md section 6. The four rules are
 * implemented verbatim; detail strings are quoted from the spec.
 */
import type { Dim, Grouping, Notice, ViewState } from '../contract';

/** Columns that carry disposition information. */
const DISPOSITION_COLS = new Set([
  'disposition_date',
  'disposition_code',
  'disposition_description',
  'disposition_reason',
  'disposition_source',
  'disposed_under',
  'disposed_in_window',
]);

function dimInvolvesDisposition(dim: Dim | null, groupings: Grouping[]): boolean {
  if (!dim) return false;
  if (dim.kind === 'col') return DISPOSITION_COLS.has(dim.col);
  const g = groupings.find((x) => x.id === dim.groupingId);
  return g ? DISPOSITION_COLS.has(g.column) : false;
}

/**
 * Does the view's effective date range intersect [startIso, endIso]?
 * A null bound means the range is open on that side.
 */
function rangeTouches(view: ViewState, startIso: string, endIso: string): boolean {
  const { dateFrom, dateTo } = view;
  if (dateTo !== null && dateTo < startIso) return false;
  if (dateFrom !== null && dateFrom > endIso) return false;
  return true;
}

export function noticesFor(view: ViewState, groupings: Grouping[]): Notice[] {
  const notices: Notice[] = [];

  // 1. Missing Suffolk Superior dispositions from Oct 2024 on.
  if (view.lens === 'dispositions') {
    const courtFilter = view.filters?.['court'] ?? [];
    const courtApplies =
      courtFilter.length === 0 || courtFilter.includes('Suffolk Superior Court');
    if (courtApplies && rangeTouches(view, '2024-10-01', '9999-12-31')) {
      notices.push({
        level: 'warn',
        title: 'Superior Court dispositions missing',
        detail:
          'Suffolk Superior dispositions are missing from Oct 2024 through Dec 2025 (~2,000 charges; records request pending). Totals for that period undercount the felony docket.',
      });
    }
  }

  // 2. 2025 filings undercount from sealed-case removal.
  if (view.lens === 'filings' && rangeTouches(view, '2025-01-01', '2025-12-31')) {
    notices.push({
      level: 'info',
      title: '2025 filings run low',
      detail:
        '2025 filings run ~2-3% low: sealed cases were removed before the Mar 2026 extract.',
    });
  }

  // 3. Right-censored outcomes on filing cohorts.
  if (
    view.lens === 'filings' &&
    dimInvolvesDisposition(view.series, groupings)
  ) {
    notices.push({
      level: 'warn',
      title: 'Outcomes are right-censored',
      detail:
        'Outcome shares for 2024-2025 filing cohorts are right-censored: 46,575 charges were still open at extraction.',
    });
  }

  // 4. Window opens Jan 3, 2022.
  if (view.lens === 'dispositions' && rangeTouches(view, '2022-01-01', '2022-01-31')) {
    notices.push({
      level: 'info',
      title: 'Window opens Jan 3, 2022',
      detail: 'Window opens Jan 3, 2022; Jan 1-2 had no filings (weekend).',
    });
  }

  return notices;
}
