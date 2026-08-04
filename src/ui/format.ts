import { COLUMNS, MEASURES, type Dim, type Grouping, type ViewState } from '../contract';
import type { Palette } from './theme';

export const MONO =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

/** Compact axis-tick formatter: 43880 -> 44k. */
export function fmtAxis(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trimZero((n / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${trimZero((n / 1_000).toFixed(1))}k`;
  if (!Number.isInteger(n)) return n.toFixed(1);
  return String(n);
}

function trimZero(s: string): string {
  return s.replace(/\.0$/, '');
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Empty strings read as a labeled blank instead of vanishing. */
export function displayValue(v: string): string {
  return v === '' ? '(blank)' : v;
}

export function colLabel(name: string): string {
  return COLUMNS.find((c) => c.name === name)?.label ?? name;
}

export function isDateCol(name: string): boolean {
  return COLUMNS.find((c) => c.name === name)?.kind === 'date';
}

export function dimLabel(dim: Dim | null, groupings: Grouping[]): string {
  if (!dim) return 'None';
  if (dim.kind === 'col') return colLabel(dim.col);
  const g = groupings.find((x) => x.id === dim.groupingId);
  return g ? `Custom: ${g.name}` : 'Custom: (missing)';
}

/**
 * Series color assignment: PALETTE.series in seriesOrder position, except the
 * engine's fold bucket 'Other' which always wears ink3 gray. Never cycles hues.
 */
export function seriesColors(order: string[], palette: Palette): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  for (const s of order) {
    out[s] =
      s === 'Other' ? palette.ink3 : palette.series[Math.min(i++, palette.series.length - 1)];
  }
  return out;
}

/** Human title for the current view, e.g. "Charges by month, split by Court". */
export function viewTitle(view: ViewState, groupings: Grouping[]): string {
  const measure = MEASURES[view.measure];
  let xPart: string;
  if (view.x && view.x.kind === 'col' && isDateCol(view.x.col)) {
    xPart = `by ${view.granularity}`;
  } else if (view.x) {
    xPart = `by ${dimLabel(view.x, groupings)}`;
  } else {
    xPart = '';
  }
  const sPart = view.series ? `, split by ${dimLabel(view.series, groupings)}` : '';
  const pctPart = view.pct ? ' as % of total' : '';
  return `${measure}${pctPart} ${xPart}${sPart}`.replace(/\s+/g, ' ').trim();
}
