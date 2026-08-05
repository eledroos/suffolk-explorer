import { useMemo } from 'react';
import type { AggResult } from '../contract';
import { displayValue, fmtInt, fmtPct, truncate } from './format';
import type { Mode, Palette } from './theme';
import { valueGrid } from './transform';

interface HeatmapProps {
  agg: AggResult;
  palette: Palette;
  mode: Mode;
  pct: boolean;
  /** x label -> severity, for time columns inside a known coverage band. */
  bandMarks?: Map<string, 'gap' | 'floor' | 'haze'>;
}

/**
 * HTML/CSS heatmap: x dimension across columns, series dimension down rows,
 * cell fill stepped through PALETTE.seq. No recharts involved.
 */
export default function Heatmap({ agg, palette, mode, pct, bandMarks }: HeatmapProps) {
  const cols = agg.xOrder;
  const rows = agg.seriesOrder;
  const grid = useMemo(() => valueGrid(agg), [agg]);

  const colTotals = useMemo(() => {
    const t = new Map<string, number>();
    for (const r of agg.rows) t.set(r.x, (t.get(r.x) ?? 0) + r.value);
    return t;
  }, [agg]);

  const cellValue = (x: string, s: string): number | null => {
    const raw = grid.get(x)?.get(s);
    if (raw === undefined) return null;
    if (!pct) return raw;
    const base = colTotals.get(x) ?? 0;
    return base > 0 ? (raw / base) * 100 : 0;
  };

  const max = useMemo(() => {
    let m = 0;
    for (const x of cols) {
      for (const s of rows) {
        const v = cellValue(x, s);
        if (v !== null && v > m) m = v;
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agg, pct]);

  // Text must stay readable on the ramp: light steps get dark ink, dark steps
  // get the surface/page tone. seq runs light->dark in light mode, dark->light in dark mode.
  const textFor = (step: number): string => {
    if (mode === 'light') return step < 4 ? palette.ink1 : palette.surface;
    return step < 4 ? palette.ink1 : palette.page;
  };

  // Thin out column labels when there are many (48 months would collide).
  const labelEvery = Math.max(1, Math.ceil(cols.length / 14));
  const showCellText = cols.length <= 20 && rows.length <= 24;

  const fmt = (v: number) => (pct ? fmtPct(v) : fmtInt(v));

  return (
    <div className="heatmap-scroll">
      <div
        className="heatmap"
        style={{
          gridTemplateColumns: `minmax(140px, max-content) repeat(${cols.length}, minmax(${showCellText ? 44 : 14}px, 1fr))`,
        }}
        role="table"
        aria-label="Heatmap"
      >
        <div role="row" style={{ display: 'contents' }}>
          <div className="hm-corner" role="columnheader" />
          {cols.map((x, i) => (
            <div
              key={x}
              className={labelEvery > 1 ? 'hm-collabel hm-collabel-sparse' : 'hm-collabel'}
              role="columnheader"
              aria-label={displayValue(x)}
              title={displayValue(x)}
            >
              {i % labelEvery === 0 ? <span>{truncate(displayValue(x), 10)}</span> : null}
              {bandMarks?.has(x) && (
                <i className={`hm-band-dot sev-${bandMarks.get(x)}`} aria-hidden />
              )}
            </div>
          ))}
        </div>
        {rows.map((s) => (
          <HeatRow
            key={s}
            series={s}
            cols={cols}
            cellValue={cellValue}
            max={max}
            palette={palette}
            textFor={textFor}
            showText={showCellText}
            fmt={fmt}
          />
        ))}
      </div>
      <div className="hm-legend">
        <span className="hm-legend-min">0</span>
        {palette.seq.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
        <span className="hm-legend-max">{max > 0 ? fmt(max) : '0'}</span>
      </div>
    </div>
  );
}

function HeatRow({
  series,
  cols,
  cellValue,
  max,
  palette,
  textFor,
  showText,
  fmt,
}: {
  series: string;
  cols: string[];
  cellValue: (x: string, s: string) => number | null;
  max: number;
  palette: Palette;
  textFor: (step: number) => string;
  showText: boolean;
  fmt: (v: number) => string;
}) {
  return (
    <div role="row" style={{ display: 'contents' }}>
      <div className="hm-rowlabel" role="rowheader" title={displayValue(series)}>
        {truncate(displayValue(series), 24)}
      </div>
      {cols.map((x) => {
        const v = cellValue(x, series);
        if (v === null) {
          return (
            <div
              key={x}
              className="hm-cell hm-cell-empty"
              role="cell"
              aria-label="No data"
              title={`${displayValue(series)} / ${displayValue(x)}: no data`}
            />
          );
        }
        const step = max > 0 ? Math.min(palette.seq.length - 1, Math.floor((v / max) * palette.seq.length)) : 0;
        return (
          <div
            key={x}
            className="hm-cell"
            role="cell"
            aria-label={fmt(v)}
            style={{ background: palette.seq[step], color: textFor(step) }}
            title={`${displayValue(series)} / ${displayValue(x)}: ${fmt(v)}`}
          >
            {showText ? fmt(v) : ''}
          </div>
        );
      })}
    </div>
  );
}
