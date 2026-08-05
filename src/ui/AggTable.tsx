import { useMemo, useState } from 'react';
import { MEASURES, type AggResult, type Grouping, type ViewState } from '../contract';
import { dimLabel, displayValue, fmtInt, fmtPct, isDateCol } from './format';
import { hasSeries } from './transform';

interface AggTableProps {
  agg: AggResult;
  view: ViewState;
  groupings: Grouping[];
}

type SortKey = 'x' | 'series' | 'value' | 'share';

interface TableRow {
  x: string;
  series: string | null;
  value: number;
  share: number; // 0-100
}

/** Sortable aggregated table; used for the table chart type and the under-chart disclosure. */
export default function AggTable({ agg, view, groupings }: AggTableProps) {
  const withSeries = hasSeries(agg);
  const [sortKey, setSortKey] = useState<SortKey>('x');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const xLabel =
    view.x && view.x.kind === 'col' && isDateCol(view.x.col)
      ? `${view.granularity[0].toUpperCase()}${view.granularity.slice(1)}`
      : dimLabel(view.x, groupings);
  const seriesLabel = dimLabel(view.series, groupings);

  const lensPct = view.pct && view.pctDenom === 'lens' && !!agg.xBaseline;
  const rows = useMemo<TableRow[]>(() => {
    const xSums = new Map<string, number>();
    if (withSeries && !lensPct) {
      for (const r of agg.rows) xSums.set(r.x, (xSums.get(r.x) ?? 0) + r.value);
    }
    return agg.rows.map((r) => {
      const base = lensPct
        ? agg.xBaseline![r.x] ?? 0
        : withSeries
          ? xSums.get(r.x) ?? 0
          : agg.total;
      return {
        x: r.x,
        series: r.series,
        value: r.value,
        share: base > 0 ? (r.value / base) * 100 : 0,
      };
    });
  }, [agg, withSeries, lensPct]);

  const sorted = useMemo(() => {
    const xIndex = new Map(agg.xOrder.map((x, i) => [x, i]));
    const sIndex = new Map(agg.seriesOrder.map((s, i) => [s, i]));
    const cmp = (a: TableRow, b: TableRow): number => {
      switch (sortKey) {
        case 'x':
          return (xIndex.get(a.x) ?? 0) - (xIndex.get(b.x) ?? 0);
        case 'series':
          return (sIndex.get(a.series ?? '') ?? 0) - (sIndex.get(b.series ?? '') ?? 0);
        case 'value':
          return a.value - b.value;
        case 'share':
          return a.share - b.share;
      }
    };
    return [...rows].sort((a, b) => sortDir * cmp(a, b));
  }, [rows, sortKey, sortDir, agg.xOrder, agg.seriesOrder]);

  const clickSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(k);
      setSortDir(k === 'value' || k === 'share' ? -1 : 1);
    }
  };

  const arrow = (k: SortKey) =>
    sortKey === k ? (
      <span className="sort-arrow" aria-hidden>
        {sortDir === 1 ? '▴' : '▾'}
      </span>
    ) : null;

  const sortState = (k: SortKey): 'ascending' | 'descending' | undefined =>
    sortKey === k ? (sortDir === 1 ? 'ascending' : 'descending') : undefined;

  const sumValues = rows.reduce((acc, r) => acc + r.value, 0);

  return (
    <div className="tablewrap">
      <table className="aggtable">
        <thead>
          <tr>
            <th aria-sort={sortState('x')}>
              <button className="th-sort" onClick={() => clickSort('x')}>
                {xLabel} {arrow('x')}
              </button>
            </th>
            {withSeries && (
              <th aria-sort={sortState('series')}>
                <button className="th-sort" onClick={() => clickSort('series')}>
                  {seriesLabel} {arrow('series')}
                </button>
              </th>
            )}
            <th className="num" aria-sort={sortState('value')}>
              <button className="th-sort" onClick={() => clickSort('value')}>
                {MEASURES[view.measure]} {arrow('value')}
              </button>
            </th>
            <th className="num" aria-sort={sortState('share')}>
              <button
                className="th-sort"
                onClick={() => clickSort('share')}
                title={
                  lensPct
                    ? 'Share of ALL rows in this lens for that x, ignoring filters'
                    : withSeries
                      ? 'Share within each x value'
                      : 'Share of the filtered total'
                }
              >
                Share {arrow('share')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={`${r.x}|${r.series ?? ''}|${i}`}>
              <td>{displayValue(r.x)}</td>
              {withSeries && <td>{displayValue(r.series ?? '')}</td>}
              <td className="num">{fmtInt(r.value)}</td>
              <td className="num dim">{fmtPct(r.share)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={withSeries ? 4 : 3} className="table-empty">
                No rows
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={withSeries ? 2 : 1}>Sum of rows</td>
            <td className="num">{fmtInt(sumValues)}</td>
            <td className="num dim">
              {lensPct
                ? (() => {
                    const denom = Object.values(agg.xBaseline!).reduce((a, b) => a + b, 0);
                    return denom > 0 ? fmtPct((100 * sumValues) / denom) : '';
                  })()
                : view.measure === 'charges'
                  ? '100.0%'
                  : `total ${fmtInt(agg.total)}`}
            </td>
          </tr>
        </tfoot>
      </table>
      {view.measure !== 'charges' && (
        <p className="table-note">
          Distinct counts can repeat across rows; the column sum may exceed the true filtered total
          of {fmtInt(agg.total)}.
        </p>
      )}
    </div>
  );
}
