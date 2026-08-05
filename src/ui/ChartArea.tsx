import { useEffect, useMemo, useState } from 'react';
import {
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
} from '../contract';
import AggTable from './AggTable';
import { displayValue, fmtAxis, fmtInt, fmtPct, MONO, seriesColors, truncate, viewTitle } from './format';
import Heatmap from './Heatmap';
import { IconChevron } from './icons';
import Pivot from './Pivot';
import type { Mode, Palette } from './theme';
import { SINGLE_KEY, toPctData, toWide, type WideDatum, toPctOfBaseline } from './transform';

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
        return <Heatmap agg={agg} palette={palette} mode={mode} pct={view.pct} />;
      default:
        return (
          <RechartsChart agg={agg} view={view} palette={palette} chart={view.chart} />
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
            {view.pct && view.pctDenom === 'lens'
              ? ` · % of ALL ${view.lens === 'dispositions' ? 'dispositions' : view.lens === 'filings' ? 'filings' : 'charge rows'} per period, ignoring filters`
              : view.pct
                ? ' · % within the filtered view'
                : ''}
          </p>
        </div>
      </header>
      <div className="chart-body">{body}</div>
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

function RechartsChart({
  agg,
  view,
  palette,
  chart,
}: {
  agg: AggResult;
  view: ViewState;
  palette: Palette;
  chart: ChartType;
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

  let plot: JSX.Element;
  switch (chart) {
    case 'line':
      plot = (
        <LineChart data={plotData} margin={margin}>
          {grid}
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
