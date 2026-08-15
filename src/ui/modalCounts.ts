/**
 * Shared count-view helpers for filter modals whose live counts follow the
 * DTP modal's pattern (dtpModel.ts), generalized from a single hardcoded
 * column pair to an arbitrary list of "own" columns. dtpModel.ts is not
 * touched or imported from; its private buildCountView/countSignature stay
 * exactly as they were reviewed.
 */

import type { Grouping, ViewState } from '../contract';

/** The view used for a filter modal's live counts: the current view with
 *  the modal's own columns stripped from filters and measure forced to
 *  charges (counts are charge rows, whatever the chart measures). Also
 *  targets the first of `cols` as the aggregation dimension, series
 *  cleared and pct off, so the result is one raw charge count per value of
 *  that column. */
export function buildCountViewFor(cols: string[], view: ViewState): ViewState {
  const own = new Set(cols);
  const filters: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(view.filters)) {
    if (own.has(k)) continue;
    filters[k] = v;
  }
  return {
    ...view,
    x: cols.length > 0 ? { kind: 'col', col: cols[0] } : view.x,
    series: null,
    measure: 'charges',
    pct: false,
    filters,
  };
}

/** Cache signature: counts recompute only when anything OTHER than the
 *  modal's own staged columns changes. */
export function countSignatureFor(
  cols: string[],
  view: ViewState,
  groupings: Grouping[],
): string {
  const own = new Set(cols);
  const filters: Record<string, string[]> = {};
  for (const k of Object.keys(view.filters).sort()) {
    if (own.has(k)) continue;
    filters[k] = view.filters[k];
  }
  return JSON.stringify({
    lens: view.lens,
    dateFrom: view.dateFrom,
    dateTo: view.dateTo,
    history: view.history,
    filters,
    groupings,
  });
}
