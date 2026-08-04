/**
 * CSV export of the current aggregation (RFC 4180 quoting, CRLF lines).
 */
import { COLUMNS, MEASURES, type AggResult, type Dim, type ViewState } from '../contract';

function quote(field: string): string {
  return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

function dimLabel(dim: Dim | null, fallback: string): string {
  if (!dim) return fallback;
  if (dim.kind === 'col') {
    return COLUMNS.find((c) => c.name === dim.col)?.label ?? dim.col;
  }
  // aggToCsv has no groupings argument; the stable id is the best label here.
  return dim.groupingId;
}

export function aggToCsv(result: AggResult, view: ViewState): string {
  const xLabel = dimLabel(view.x, 'X');
  const measureLabel = MEASURES[view.measure] ?? view.measure;
  const hasSeries = view.series !== null;

  const lines: string[] = [];
  if (hasSeries) {
    const seriesLabel = dimLabel(view.series, 'Series');
    lines.push([xLabel, seriesLabel, measureLabel].map(quote).join(','));
    for (const row of result.rows) {
      lines.push([quote(row.x), quote(row.series ?? ''), String(row.value)].join(','));
    }
  } else {
    lines.push([xLabel, measureLabel].map(quote).join(','));
    for (const row of result.rows) {
      lines.push([quote(row.x), String(row.value)].join(','));
    }
  }
  return lines.join('\r\n');
}
