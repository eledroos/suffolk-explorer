import { useMemo } from 'react';
import type { AggResult, Grouping, ViewState } from '../contract';
import { dimLabel, displayValue, fmtInt, fmtPct, isDateCol } from './format';
import { hasSeries, valueGrid } from './transform';

interface PivotProps {
  agg: AggResult;
  view: ViewState;
  groupings: Grouping[];
}

/**
 * Pivot table: rows = series dimension, columns = x dimension, with row and
 * column totals. Plain HTML, horizontal scroll, sticky row-label column.
 */
export default function Pivot({ agg, view, groupings }: PivotProps) {
  const withSeries = hasSeries(agg);
  const cols = agg.xOrder;
  const rows = withSeries ? agg.seriesOrder : ['All'];
  const grid = useMemo(() => valueGrid(agg), [agg]);

  const cell = (x: string, s: string): number => {
    const inner = grid.get(x);
    if (!inner) return 0;
    return (withSeries ? inner.get(s) : inner.get(null)) ?? 0;
  };

  const colTotals = useMemo(
    () => cols.map((x) => rows.reduce((acc, s) => acc + cell(x, s), 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agg],
  );
  const rowTotals = useMemo(
    () => rows.map((s) => cols.reduce((acc, x) => acc + cell(x, s), 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agg],
  );
  const grand = colTotals.reduce((a, b) => a + b, 0);

  const rowsLabel = withSeries ? dimLabel(view.series, groupings) : 'All rows';
  const colsLabel =
    view.x && view.x.kind === 'col' && isDateCol(view.x.col)
      ? `${view.granularity[0].toUpperCase()}${view.granularity.slice(1)}`
      : dimLabel(view.x, groupings);

  const showPct = view.pct;

  return (
    <div className="tablewrap">
      <table className="aggtable pivot">
        <thead>
          <tr>
            <th className="pivot-corner">
              {rowsLabel} <span className="dim">\ {colsLabel}</span>
            </th>
            {cols.map((x) => (
              <th key={x} className="num" title={displayValue(x)}>
                {displayValue(x)}
              </th>
            ))}
            <th className="num pivot-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, ri) => (
            <tr key={s}>
              <td className="pivot-rowlabel" title={displayValue(s)}>
                {displayValue(s)}
              </td>
              {cols.map((x, ci) => {
                const v = cell(x, s);
                return (
                  <td key={x} className="num">
                    {showPct
                      ? colTotals[ci] > 0
                        ? fmtPct((v / colTotals[ci]) * 100)
                        : '0.0%'
                      : fmtInt(v)}
                  </td>
                );
              })}
              <td className="num pivot-total">{fmtInt(rowTotals[ri])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pivot-rowlabel">Total</td>
            {colTotals.map((t, i) => (
              <td key={cols[i]} className="num">
                {fmtInt(t)}
              </td>
            ))}
            <td className="num pivot-total">{fmtInt(grand)}</td>
          </tr>
        </tfoot>
      </table>
      {showPct && (
        <p className="table-note">Cells show each row's share of its column; totals stay raw.</p>
      )}
      {view.measure !== 'charges' && (
        <p className="table-note">
          Distinct counts can repeat across cells; totals sum the cells and may exceed the true
          distinct count ({fmtInt(agg.total)} in the filtered set).
        </p>
      )}
    </div>
  );
}
