import type { KeyboardEvent } from 'react';
import {
  COLUMNS,
  LENS_INFO,
  MEASURES,
  type ChartType,
  type Dim,
  type Granularity,
  type Grouping,
  type Lens,
  type Measure,
  type ViewState,
} from '../contract';
import { colLabel, isDateCol } from './format';
import {
  IconArea,
  IconBar,
  IconHeatmap,
  IconLine,
  IconPct,
  IconPivot,
  IconStack,
  IconTable,
} from './icons';

interface SidebarProps {
  view: ViewState;
  lensCounts: Record<Lens, number>;
  historyLoading: boolean;
  historyReady: boolean;
  groupings: Grouping[];
  onPatch: (p: Partial<ViewState>) => void;
  onLens: (lens: Lens) => void;
}

const CHART_TYPES: { type: ChartType; label: string; icon: JSX.Element; hint: string }[] = [
  { type: 'line', label: 'Line', icon: <IconLine />, hint: 'Trend over the x axis' },
  { type: 'bar', label: 'Bars', icon: <IconBar />, hint: 'Grouped bars, series side by side' },
  { type: 'stackedBar', label: 'Stacked', icon: <IconStack />, hint: 'Stacked bars, totals visible' },
  { type: 'pctBar', label: '100%', icon: <IconPct />, hint: 'Share of each x, normalized to 100%' },
  { type: 'area', label: 'Area', icon: <IconArea />, hint: 'Stacked area over time' },
  { type: 'heatmap', label: 'Heatmap', icon: <IconHeatmap />, hint: 'X by series grid, color by value' },
  { type: 'pivot', label: 'Pivot', icon: <IconPivot />, hint: 'Series rows by x columns with totals' },
  { type: 'table', label: 'Table', icon: <IconTable />, hint: 'Aggregated rows, sortable' },
];

const GRANULARITIES: Granularity[] = ['month', 'quarter', 'year'];

function dimToVal(d: Dim | null): string {
  if (!d) return '';
  return d.kind === 'col' ? `c:${d.col}` : `g:${d.groupingId}`;
}

function valToDim(v: string): Dim | null {
  if (!v) return null;
  if (v.startsWith('c:')) return { kind: 'col', col: v.slice(2) };
  return { kind: 'grouping', groupingId: v.slice(2) };
}

/**
 * Standard radio-group keyboard behavior for the button groups below:
 * arrows move and select (wrapping), Home/End jump. Buttons carry roving
 * tabindex so the whole group is one tab stop.
 */
function radioGroupKeys(
  e: KeyboardEvent<HTMLElement>,
  current: number,
  count: number,
  select: (i: number) => void,
) {
  let next = -1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (current + 1) % count;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (current - 1 + count) % count;
  else if (e.key === 'Home') next = 0;
  else if (e.key === 'End') next = count - 1;
  if (next < 0 || next === current) {
    if (next === current) e.preventDefault();
    return;
  }
  e.preventDefault();
  select(next);
  const radios = e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]');
  radios[next]?.focus();
}

export default function Sidebar({
  lensCounts, historyLoading, historyReady, view, groupings, onPatch, onLens }: SidebarProps) {
  const lensInfo = LENS_INFO[view.lens];
  const catDims = COLUMNS.filter((c) => c.groupable && c.kind === 'cat');
  const xIsTime = view.x?.kind === 'col' && isDateCol(view.x.col);

  return (
    <aside className="sidebar">
      <section className="side-section">
        <h3 className="microlabel">Lens</h3>
        <div
          className="seg seg-vert"
          role="radiogroup"
          aria-label="Lens"
          onKeyDown={(e) => {
            const lenses = Object.keys(LENS_INFO) as Lens[];
            radioGroupKeys(e, lenses.indexOf(view.lens), lenses.length, (i) => onLens(lenses[i]));
          }}
        >
          {(Object.keys(LENS_INFO) as Lens[]).map((l) => (
            <button
              key={l}
              className={`seg-opt${view.lens === l ? ' on' : ''}`}
              role="radio"
              aria-checked={view.lens === l}
              tabIndex={view.lens === l ? 0 : -1}
              onClick={() => onLens(l)}
            >
              {LENS_INFO[l].label}
              <span className="seg-count">{lensCounts[l].toLocaleString('en-US')}</span>
            </button>
          ))}
        </div>
        <p className="side-blurb">
          {view.history
            ? lensInfo.blurb.replace(
                'Jan 2022 - Dec 2025',
                view.lens === 'dispositions' ? 'Jan 2000 - Dec 2025' : 'Jan 2006 - Dec 2025',
              )
            : lensInfo.blurb}
        </p>
        <label className="field field-row history-toggle">
          <span className="field-label">Include 2006-2021</span>
          <span className={`switch${view.history ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={view.history}
              onChange={(e) => onPatch({ history: e.target.checked })}
              aria-label="Include the 2006 to 2021 history dataset"
            />
            <i />
          </span>
        </label>
        <p className="side-footnote" aria-live="polite">
          {view.history
            ? historyLoading || !historyReady
              ? 'Loading the pre-2022 composite (16 MB) ...'
              : 'Pre-2022 composite loaded: filings 2006-2021, dispositions 2000-2021, same case and person IDs as 2022-2025. 2021 dispositions are single-source.'
            : 'Adds the pre-2022 composite: 1.09M charges, filings 2006-2021 and dispositions 2000-2021 (16 MB download). Caveats appear on the charts.'}
        </p>
      </section>

      <section className="side-section">
        <h3 className="microlabel">Chart</h3>
        <div
          className="chart-grid"
          role="radiogroup"
          aria-label="Chart type"
          onKeyDown={(e) => {
            const current = CHART_TYPES.findIndex((c) => c.type === view.chart);
            radioGroupKeys(e, current, CHART_TYPES.length, (i) =>
              onPatch({ chart: CHART_TYPES[i].type }),
            );
          }}
        >
          {CHART_TYPES.map((c) => (
            <button
              key={c.type}
              className={`chart-opt${view.chart === c.type ? ' on' : ''}`}
              role="radio"
              aria-checked={view.chart === c.type}
              tabIndex={view.chart === c.type ? 0 : -1}
              title={c.hint}
              onClick={() => onPatch({ chart: c.type })}
            >
              {c.icon}
              <span>{c.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="side-section">
        <h3 className="microlabel">Encodings</h3>

        <label className="field">
          <span className="field-label">{view.chart === 'pivot' ? 'Columns (x)' : 'X axis'}</span>
          <span className="selwrap">
            <select
              value={dimToVal(view.x)}
              onChange={(e) => onPatch({ x: valToDim(e.target.value) })}
            >
              <option value={`c:${lensInfo.dateField}`}>
                Time: {colLabel(lensInfo.dateField)}
              </option>
              <optgroup label="Columns">
                {catDims.map((c) => (
                  <option key={c.name} value={`c:${c.name}`}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              {groupings.length > 0 && (
                <optgroup label="Custom groupings">
                  {groupings.map((g) => (
                    <option key={g.id} value={`g:${g.id}`}>
                      Custom: {g.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </span>
        </label>

        {xIsTime && (
          <div className="field">
            <span className="field-label">Granularity</span>
            <div
              className="seg"
              role="radiogroup"
              aria-label="Granularity"
              onKeyDown={(e) => {
                radioGroupKeys(
                  e,
                  GRANULARITIES.indexOf(view.granularity),
                  GRANULARITIES.length,
                  (i) => onPatch({ granularity: GRANULARITIES[i] }),
                );
              }}
            >
              {GRANULARITIES.map((g) => (
                <button
                  key={g}
                  className={`seg-opt${view.granularity === g ? ' on' : ''}`}
                  role="radio"
                  aria-checked={view.granularity === g}
                  tabIndex={view.granularity === g ? 0 : -1}
                  onClick={() => onPatch({ granularity: g })}
                >
                  {g[0].toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span className="field-label">{view.chart === 'pivot' ? 'Rows (series)' : 'Series'}</span>
          <span className="selwrap">
            <select
              value={dimToVal(view.series)}
              onChange={(e) => onPatch({ series: valToDim(e.target.value) })}
            >
              <option value="">None</option>
              <optgroup label="Columns">
                {catDims.map((c) => (
                  <option key={c.name} value={`c:${c.name}`}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              {groupings.length > 0 && (
                <optgroup label="Custom groupings">
                  {groupings.map((g) => (
                    <option key={g.id} value={`g:${g.id}`}>
                      Custom: {g.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </span>
        </label>

        <label className="field">
          <span className="field-label">Measure</span>
          <span className="selwrap">
            <select
              value={view.measure}
              onChange={(e) => onPatch({ measure: e.target.value as Measure })}
            >
              {(Object.keys(MEASURES) as Measure[]).map((m) => (
                <option key={m} value={m}>
                  {MEASURES[m]}
                </option>
              ))}
            </select>
          </span>
        </label>
        <p className="side-footnote" aria-live="polite">
          {view.measure === 'charges'
            ? 'Each charge counts once. A case with four charges contributes four.'
            : view.measure === 'cases'
              ? 'Each case counts once, however many charges it carries.'
              : 'Each person counts once, across all of their cases and charges.'}
        </p>

        <div className="field">
          <span className="field-label">Values</span>
          <div className="seg seg-vert" role="radiogroup" aria-label="Value mode">
            {([
              { key: 'count', label: 'Counts' },
              { key: 'view', label: '% within view' },
              { key: 'lens', label: '% of period total' },
            ] as const).map((m) => {
              const active =
                m.key === 'count' ? !view.pct : view.pct && view.pctDenom === (m.key as 'view' | 'lens');
              return (
                <button
                  key={m.key}
                  className={`seg-opt${active ? ' on' : ''}`}
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() =>
                    m.key === 'count'
                      ? onPatch({ pct: false })
                      : onPatch({ pct: true, pctDenom: m.key as 'view' | 'lens' })
                  }
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <p className="side-footnote" aria-live="polite">
          {!view.pct
            ? 'Raw counts.'
            : view.pctDenom === 'lens'
              ? `Share of ALL ${view.lens === 'dispositions' ? 'dispositions' : view.lens === 'filings' ? 'filings' : 'charge rows'} in each period. Filters and series choose the numerator; the denominator ignores them. Tables and CSV keep counts.`
              : "With a series, % is each series' share within an x value. Without one, it is the share of the filtered total."}
        </p>
      </section>
    </aside>
  );
}
