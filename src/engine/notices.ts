/**
 * Data-quality notices. Since the coverage-bands feature, most of the work
 * is delegated to the registry in coverage.ts, which covers known
 * limitations of the source deliveries (a missing court, a sealed-case
 * undercount). The severity/statute-chapter feature (2026-08-15) added one
 * notice below that the registry does not fit: it is not a data limitation,
 * it is a consequence of combining the Severity filter with the history
 * toggle, so it lives here instead of as a CoverageEntry.
 */
import type { Grouping, Notice, ViewState } from '../contract';
import { noticesFromRegistry } from './coverage';

/** Mirrors severityModel.SEVERITY_COL / SEVERITY_HISTORY_VALUE as literals:
    engine/** does not import from ui/** (see DESIGN.md's module ownership),
    so the two constants are duplicated here rather than imported. */
const SEVERITY_COL = 'severity_class';
const SEVERITY_HISTORY_VALUE = 'Not graded (pre-2022)';

export function noticesFor(view: ViewState, groupings: Grouping[]): Notice[] {
  const out = noticesFromRegistry(view, groupings);

  const severitySelected = view.filters[SEVERITY_COL] ?? [];
  if (
    severitySelected.length > 0 &&
    view.history === true &&
    !severitySelected.includes(SEVERITY_HISTORY_VALUE)
  ) {
    out.push({
      level: 'info',
      title: 'Severity filter excludes 2006-2021',
      detail:
        'The pre-2022 dataset is not graded for severity, so an active severity filter excludes all of it. Select "Not graded (pre-2022)" in the Severity filter to include those charges.',
    });
  }

  return out;
}
