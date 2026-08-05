import { useEffect, useMemo, useState } from 'react';
import {
  Customized,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  LENS_INFO,
  MEASURES,
  type AggResult,
  type ChartType,
  type Grouping,
  type ViewState,
  ERA_BOUNDARIES,
} from '../contract';
import AggTable from './AggTable';
import { displayValue, fmtAxis, fmtInt, fmtPct, MONO, seriesColors, truncate, viewTitle, isDateCol } from './format';
import Heatmap from './Heatmap';
import { IconChevron } from './icons';
import Pivot from './Pivot';
import type { Mode, Palette } from './theme';
import { SINGLE_KEY, toPctData, toWide, type WideDatum, toPctOfBaseline } from './transform';
import { bandBuckets, bandsFor, fmtMonth, type ActiveBand } from '../engine';

interface ChartAreaProps {
  agg: AggResult | null;
  aggError: string | null;
  view: ViewState;
  groupings: Grouping[];
  palette: Palette;
  mode: Mode;
  showTable: boolean;
  onToggleTable: () => void;
}

type TooltipMode = 'raw' | 'pctData' | 'expand';

export default function ChartArea(p: ChartAreaProps) {
  const { agg, aggError, view, groupings, palette, mode } = p;
  const activeBands = useMemo(() => bandsFor(view, groupings), [view, groupings]);
  const xIsTime =
    view.x?.kind === 'col' &&
    isDateCol(view.x.col) &&
    view.x.col === LENS_INFO[view.lens].dateField;

  const body = (() => {
    if (aggError) {
      return (
        <div className="chart-message chart-error">
          <strong>The aggregation failed.</strong>
          <span>{aggError}</span>
        </div>
      );
    }
    if (!agg) return <div className="chart-message">Preparing…</div>;
    if (agg.rows.length === 0) {
      return (
        <div className="chart-message">
          <strong>No rows match the current filters.</strong>
          <span>Loosen a filter or widen the date range.</span>
        </div>
      );
    }
    if (view.chart === 'heatmap' && view.series === null) {
      return (
        <div className="chart-message">
          <strong>The heatmap needs a series dimension.</strong>
          <span>Pick one under Encodings, for example Court or Crime type.</span>
        </div>
      );
    }
    switch (view.chart) {
      case 'table':
        return <AggTable agg={agg} view={view} groupings={groupings} />;
      case 'pivot':
        return <Pivot agg={agg} view={view} groupings={groupings} />;
      case 'heatmap':
        return <Heatmap agg={agg} palette={palette} mode={mode} pct={view.pct} bandMarks={xIsTime ? heatmapBandMarks(activeBands, agg.xOrder, view.granularity) : undefined} />;
      default:
        return (
          <RechartsChart agg={agg} view={view} palette={palette} chart={view.chart} bands={xIsTime ? activeBands : []} timeAxis={xIsTime} />
        );
    }
  })();

  return (
    <section className="chart-card">
      <header className="chart-head">
        <div>
          <h2 className="chart-title">{agg ? viewTitle(view, groupings) : 'Loading'}</h2>
          <p className="chart-sub">
            {LENS_INFO[view.lens].label} lens
            {agg
              ? view.measure === 'charges'
                ? ` · ${fmtInt(agg.filteredRowCount)} charge rows in view`
                : ` · ${fmtInt(agg.total)} distinct ${view.measure === 'cases' ? 'cases' : 'people'} · from ${fmtInt(agg.filteredRowCount)} charge rows in view`
              : ''}
            {view.measure === 'cases' && view.caseScope === 'all' && view.lens !== 'all'
              ? ' · only cases where every charge matches'
              : ''}
            {view.pct && view.pctDenom === 'lens'
              ? ` · % of ALL ${view.lens === 'dispositions' ? 'dispositions' : view.lens === 'filings' ? 'filings' : 'charge rows'} per period, ignoring filters`
              : view.pct
                ? ' · % within the filtered view'
                : ''}
          </p>
        </div>
      </header>
      <div className="chart-body">{body}</div>
      {agg && activeBands.length > 0 && (
        <div className="band-chips" role="note" aria-label="Known data limitations in this view">
          {activeBands.map((b) => {
            const bandsDrawn =
              xIsTime && ['line', 'bar', 'stackedBar', 'pctBar', 'area'].includes(view.chart);
            const bb = bandBuckets(b, view.granularity);
            let note = '';
            if (bandsDrawn) {
              const anyVisible = agg.xOrder.some((x) => x >= bb.start && x <= bb.end);
              if (!anyVisible) {
                note = ' The affected months have no plotted data in this view.';
              } else {
                const partials = [
                  bb.startPartial && agg.xOrder.includes(bb.start) ? bb.start : null,
                  bb.endPartial && agg.xOrder.includes(bb.end) ? bb.end : null,
                ].filter((x): x is string => x !== null);
                if (partials.length > 0) {
                  note = ` Shaded ${partials.join(' and ')} ${partials.length > 1 ? 'are' : 'is'} only partially affected.`;
                }
              }
            }
            const full = `${b.short}, ${fmtMonth(b.from)} to ${fmtMonth(b.to)}. ${b.detail}${note}`;
            return (
              <span
                key={b.id}
                className={`band-chip sev-${b.severity}`}
                tabIndex={0}
                role="note"
                aria-label={full}
                title={`${b.detail}${note}`}
              >
                <i />
                {b.short} · {fmtMonth(b.from)} - {fmtMonth(b.to)}
              </span>
            );
          })}
        </div>
      )}
      {view.chart !== 'table' && agg && agg.rows.length > 0 && (
        <div className="table-disclosure">
          <button className="disclosure-btn" onClick={p.onToggleTable} aria-expanded={p.showTable}>
            <IconChevron open={p.showTable} />
            {p.showTable
              ? 'Hide data table'
              : `Show data table (${fmtInt(agg.rows.length)} row${agg.rows.length === 1 ? '' : 's'})`}
          </button>
          {p.showTable && <AggTable agg={agg} view={view} groupings={groupings} />}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- recharts

/** x labels covered by any band, with the strongest severity, for heatmap dots. */
function heatmapBandMarks(
  bands: ActiveBand[],
  xOrder: string[],
  gran: 'month' | 'quarter' | 'year',
): Map<string, ActiveBand['severity']> | undefined {
  if (bands.length === 0) return undefined;
  const rank = { gap: 3, floor: 2, haze: 1 } as const;
  const out = new Map<string, ActiveBand['severity']>();
  for (const b of bands) {
    const bb = bandBuckets(b, gran);
    for (const x of xOrder) {
      if (x >= bb.start && x <= bb.end) {
        const prev = out.get(x);
        if (!prev || rank[b.severity] > rank[prev]) out.set(x, b.severity);
      }
    }
  }
  return out.size > 0 ? out : undefined;
}

function RechartsChart({
  agg,
  view,
  palette,
  chart,
  bands,
  timeAxis,
}: {
  agg: AggResult;
  view: ViewState;
  palette: Palette;
  chart: ChartType;
  bands: ActiveBand[];
  timeAxis: boolean;
}) {
  const { data, seriesKeys } = useMemo(() => toWide(agg), [agg]);
  const single = seriesKeys.length === 1 && seriesKeys[0] === SINGLE_KEY;

  const colors = useMemo(() => {
    if (single) return { [SINGLE_KEY]: palette.series[0] };
    return seriesColors(seriesKeys, palette);
  }, [single, seriesKeys, palette]);

  const nameFor = (key: string) =>
    key === SINGLE_KEY ? MEASURES[view.measure] : displayValue(key);

  // Legend click-to-isolate: display-only. Hidden series are removed from the
  // RENDER, never from the math -- every transform below runs on the full key
  // set first, so shares keep their denominators.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const seriesSig = JSON.stringify(seriesKeys);
  useEffect(() => {
    setHidden((prev) => (prev.size > 0 ? new Set() : prev));
  }, [view, seriesSig]);
  // Render-time guard: between a view change and the reset effect, keys from
  // the previous series dim must not act on the new chart. Only names present
  // in the CURRENT key set count as hidden.
  const effectiveHidden = useMemo(() => {
    if (hidden.size === 0) return hidden;
    const cur = new Set(seriesKeys);
    return new Set([...hidden].filter((k) => cur.has(k)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, seriesSig]);
  const isolate = !single && effectiveHidden.size > 0 && effectiveHidden.size < seriesKeys.length;
  const visibleKeys = isolate ? seriesKeys.filter((k) => !effectiveHidden.has(k)) : seriesKeys;
  const toggleSeries = (k: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else {
        next.add(k);
        if (next.size >= seriesKeys.length) return new Set<string>(); // never hide everything
      }
      return next;
    });
  };

  // pctBar always normalizes; stacked bar/area normalize via stackOffset when
  // pct is on; line and grouped bar get pre-transformed data instead.
  const lensPct = view.pct && view.pctDenom === 'lens' && !!agg.xBaseline;
  const expand =
    (chart === 'pctBar' || ((chart === 'stackedBar' || chart === 'area') && view.pct)) && !lensPct;
  const transformPct = (chart === 'line' || chart === 'bar') && view.pct && !lensPct;
  // With isolation active, recharts' stackOffset='expand' would renormalize
  // over only the rendered series; pre-compute the shares over ALL series
  // instead and stack the explicit percentages.
  const expandExplicit = expand && isolate;
  const expandActive = expand && !isolate;
  const plotData = useMemo(
    () =>
      lensPct
        ? toPctOfBaseline(data, seriesKeys, agg.xBaseline!)
        : transformPct || expandExplicit
          ? toPctData(data, seriesKeys, agg.total)
          : data,
    [lensPct, transformPct, expandExplicit, data, seriesKeys, agg.total, agg.xBaseline],
  );
  const tooltipMode: TooltipMode = expandActive
    ? 'expand'
    : lensPct || transformPct || expandExplicit
      ? 'pctData'
      : 'raw';

  const tickStyle = { fill: palette.ink2, fontSize: 11, fontFamily: MONO };
  const xAxis = (
    <XAxis
      dataKey="__x"
      tick={tickStyle}
      tickLine={false}
      axisLine={{ stroke: palette.axis }}
      minTickGap={24}
      tickFormatter={(v: string) => truncate(displayValue(String(v)), 12)}
    />
  );
  const yAxis = (
    <YAxis
      tick={tickStyle}
      tickLine={false}
      axisLine={false}
      width={46}
      tickFormatter={(v: number) =>
        expandActive
          ? `${Math.round(v * 100)}%`
          : lensPct || transformPct || expandExplicit
            ? `${fmtAxis(v)}%`
            : fmtAxis(v)
      }
    />
  );
  const grid = <CartesianGrid stroke={palette.grid} strokeWidth={1} vertical={false} />;
  const tooltip = (cursor: object | boolean) => (
    <Tooltip
      cursor={cursor}
      isAnimationActive={false}
      content={
        <ChartTooltip palette={palette} tooltipMode={tooltipMode} nameFor={nameFor} colors={colors} sumPartial={isolate} />
      }
    />
  );
  const margin = { top: 8, right: 12, bottom: 4, left: 4 };

  // Coverage bands: severity-tinted rects behind the marks. Pixel edges come
  // from recharts' own x scale so bands stay aligned across chart types
  // (band scale for bars, point scale for line/area). pointer-events: none.
  const cpPalette = palette;
  const drawBands = (cp: any): JSX.Element | null => {
    const axis: any = Object.values(cp?.xAxisMap ?? {})[0];
    const off = cp?.offset;
    if (!axis?.scale || !off) return null;
    const scale = axis.scale;
    const bw = typeof scale.bandwidth === 'function' ? scale.bandwidth() : 0;
    const xs = agg.xOrder;
    const center = (i: number) => (bw > 0 ? scale(xs[i]) + bw / 2 : scale(xs[i]));
    const leftEdge = (i: number) =>
      bw > 0 ? scale(xs[i]) : i === 0 ? off.left : (center(i - 1) + center(i)) / 2;
    const rightEdge = (i: number) =>
      bw > 0
        ? scale(xs[i]) + bw
        : i === xs.length - 1
          ? off.left + off.width
          : (center(i) + center(i + 1)) / 2;
    const ALPHA: Record<string, number> = { gap: 0.12, floor: 0.1, haze: 0.08 };
    const rects: JSX.Element[] = [];
    let needHatch = false;
    for (const b of bands) {
      const bb = bandBuckets(b, view.granularity);
      let i0 = -1;
      let i1 = -1;
      for (let i = 0; i < xs.length; i++) {
        if (xs[i] >= bb.start && xs[i] <= bb.end) {
          if (i0 < 0) i0 = i;
          i1 = i;
        }
      }
      if (i0 < 0) continue;
      const fill = b.severity === 'gap' ? palette.crit : palette.warn;
      const alpha = ALPHA[b.severity];
      // edge buckets a band only partially covers render at half strength
      const segs: { a: number; z: number; scale: number }[] = [];
      let a = i0;
      if (xs[i0] === bb.start && bb.startPartial) {
        segs.push({ a: i0, z: i0, scale: 0.5 });
        a = i0 + 1;
      }
      let z = i1;
      let endSeg: { a: number; z: number; scale: number } | null = null;
      if (xs[i1] === bb.end && bb.endPartial && i1 >= a) {
        endSeg = { a: i1, z: i1, scale: 0.5 };
        z = i1 - 1;
      }
      if (a <= z) segs.push({ a, z, scale: 1 });
      if (endSeg) segs.push(endSeg);
      for (const seg of segs) {
        const x1 = leftEdge(seg.a);
        const x2 = rightEdge(seg.z);
        if (!(x2 > x1)) continue;
        rects.push(
          <rect
            key={`${b.id}-${seg.a}-${seg.scale}`}
            x={x1}
            y={off.top}
            width={x2 - x1}
            height={off.height}
            fill={fill}
            fillOpacity={alpha * seg.scale}
          />,
        );
        if (b.severity === 'gap') {
          needHatch = true;
          rects.push(
            <rect
              key={`${b.id}-${seg.a}-${seg.scale}-h`}
              x={x1}
              y={off.top}
              width={x2 - x1}
              height={off.height}
              fill="url(#sda-band-hatch)"
              fillOpacity={seg.scale}
            />,
          );
        }
      }
    }
    // DA-era boundaries as first-class rules (drawn whenever visible)
    const eraMarks: JSX.Element[] = [];
    for (const eb of timeAxis ? ERA_BOUNDARIES : []) {
      const [ey, em] = eb.date.split('-').map(Number);
      const label =
        view.granularity === 'year'
          ? String(ey)
          : view.granularity === 'quarter'
            ? `${ey}-Q${Math.floor((em - 1) / 3) + 1}`
            : `${ey}-${String(em).padStart(2, '0')}`;
      const idx = xs.indexOf(label);
      if (idx < 0) continue;
      const x = leftEdge(idx);
      eraMarks.push(
        <g key={eb.label}>
          <line
            x1={x}
            x2={x}
            y1={off.top}
            y2={off.top + off.height}
            stroke={cpPalette.ink3}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={x + (x > off.left + off.width - 64 ? -4 : 4)}
            y={off.top + 11}
            fill={cpPalette.ink2}
            fontSize={10.5}
            fontFamily="system-ui, sans-serif"
            textAnchor={x > off.left + off.width - 64 ? 'end' : 'start'}
          >
            {eb.label} {'\u2192'}
          </text>
        </g>,
      );
    }
    if (rects.length === 0 && eraMarks.length === 0) return null;
    return (
      <g pointerEvents="none" aria-hidden>
        {needHatch && (
          <defs>
            <pattern
              id="sda-band-hatch"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <line x1="0" y1="0" x2="0" y2="7" stroke={palette.crit} strokeOpacity="0.25" strokeWidth="1.5" />
            </pattern>
          </defs>
        )}
        {rects}
        {eraMarks}
      </g>
    );
  };
  const bandsLayer = <Customized component={drawBands} />;

  let plot: JSX.Element;
  switch (chart) {
    case 'line':
      plot = (
        <LineChart data={plotData} margin={margin}>
          {grid}
          {bandsLayer}
          {xAxis}
          {yAxis}
          {tooltip({ stroke: palette.axis, strokeWidth: 1 })}
          {visibleKeys.map((k) => (
            <Line
              key={k}
              dataKey={k}
              name={nameFor(k)}
              stroke={colors[k]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0, fill: colors[k] }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      );
      break;
    case 'bar':
      plot = (
        <BarChart data={plotData} margin={margin} barCategoryGap="24%" barGap={2}>
          {grid}
          {bandsLayer}
          {xAxis}
          {yAxis}
          {tooltip({ fill: palette.grid, fillOpacity: 0.4 })}
          {visibleKeys.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              name={nameFor(k)}
              fill={colors[k]}
              maxBarSize={40}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      );
      break;
    case 'stackedBar':
    case 'pctBar':
      plot = (
        <BarChart
          data={plotData}
          margin={margin}
          barCategoryGap="24%"
          stackOffset={expandActive ? 'expand' : 'none'}
        >
          {grid}
          {bandsLayer}
          {xAxis}
          {yAxis}
          {tooltip({ fill: palette.grid, fillOpacity: 0.4 })}
          {visibleKeys.map((k) => (
            <Bar
              key={k}
              dataKey={k}
              name={nameFor(k)}
              stackId="stack"
              fill={colors[k]}
              stroke={palette.surface}
              strokeWidth={1}
              maxBarSize={48}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      );
      break;
    case 'area':
    default:
      plot = (
        <AreaChart data={plotData} margin={margin} stackOffset={expandActive ? 'expand' : 'none'}>
          {grid}
          {bandsLayer}
          {xAxis}
          {yAxis}
          {tooltip({ stroke: palette.axis, strokeWidth: 1 })}
          {visibleKeys.map((k) => (
            <Area
              key={k}
              dataKey={k}
              name={nameFor(k)}
              stackId="stack"
              stroke={colors[k]}
              strokeWidth={1.5}
              fill={colors[k]}
              fillOpacity={0.72}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      );
      break;
  }

  return (
    <div>
      <div className="chart-plot">
        <ResponsiveContainer width="100%" height={400}>
          {plot}
        </ResponsiveContainer>
      </div>
      {!single && seriesKeys.length > 1 && (
        <>
          <div className="chart-legend" role="group" aria-label="Legend. Click a series to hide or show it.">
            {seriesKeys.map((k) => (
              <button
                key={k}
                type="button"
                className={`legend-item${effectiveHidden.has(k) ? ' off' : ''}`}
                aria-pressed={!effectiveHidden.has(k)}
                aria-label={`${displayValue(k)} series, ${effectiveHidden.has(k) ? 'hidden' : 'visible'}. Toggle visibility; display only.`}
                title={effectiveHidden.has(k) ? 'Show this series' : 'Hide this series (display only)'}
                onClick={() => toggleSeries(k)}
              >
                <i style={{ background: colors[k] }} />
                {truncate(displayValue(k), 28)}
              </button>
            ))}
          </div>
          <p className="legend-note">
            <span role="status">
              {isolate
                ? `Showing ${visibleKeys.length} of ${seriesKeys.length} series${
                    view.pct || chart === 'pctBar'
                      ? '; percentages keep the full denominator'
                      : ' (display only)'
                  }.`
                : ''}
            </span>
            {isolate && (
              <>
                {' '}
                <button type="button" className="linklike" onClick={() => setHidden(new Set())}>
                  Show all
                </button>
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- tooltip

function ChartTooltip(props: any) {
  const { active, payload, label, palette, tooltipMode, nameFor, colors, sumPartial } = props as {
    active?: boolean;
    payload?: { dataKey: string; value: number }[];
    label?: string;
    palette: Palette;
    tooltipMode: TooltipMode;
    nameFor: (k: string) => string;
    colors: Record<string, string>;
    sumPartial?: boolean;
  };
  if (!active || !payload || payload.length === 0) return null;

  const entries = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const sum = entries.reduce((acc, e) => acc + (e.value ?? 0), 0);

  const fmtEntry = (v: number): string => {
    switch (tooltipMode as TooltipMode) {
      case 'pctData':
        return fmtPct(v);
      case 'expand':
        return sum > 0 ? `${fmtInt(v)} · ${fmtPct((v / sum) * 100)}` : fmtInt(v);
      default:
        return fmtInt(v);
    }
  };

  return (
    <div
      className="chart-tooltip"
      style={{ background: palette.surface, borderColor: palette.grid, color: palette.ink1 }}
    >
      <div className="tt-label" style={{ color: palette.ink3 }}>
        {displayValue(String(label ?? ''))}
      </div>
      {entries.map((e) => (
        <div key={e.dataKey} className="tt-row">
          <i style={{ background: colors[e.dataKey] ?? palette.ink3 }} />
          <span className="tt-name" style={{ color: palette.ink2 }}>
            {truncate(nameFor(String(e.dataKey)), 26)}
          </span>
          <span className="tt-value" style={{ color: palette.ink1 }}>
            {fmtEntry(e.value ?? 0)}
          </span>
        </div>
      ))}
      {tooltipMode === 'raw' && entries.length > 1 && (
        <div className="tt-row tt-sum">
          <i style={{ background: 'transparent' }} />
          <span className="tt-name" style={{ color: palette.ink3 }}>
            {sumPartial ? 'Sum of shown' : 'Sum'}
          </span>
          <span className="tt-value" style={{ color: palette.ink2 }}>
            {fmtInt(sum)}
          </span>
        </div>
      )}
    </div>
  );
}
