import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  aggregate,
  aggToCsv,
  decodeView,
  encodeView,
  loadDataset,
  loadGroupings,
  noticesFor,
  PRESET_GROUPINGS,
  saveGroupings,
} from './engine';
import {
  DATA_URL,
  DEFAULT_VIEW,
  LENS_INFO,
  type AggResult,
  type Dataset,
  type Grouping,
  type Lens,
  type Notice,
  type ViewState,
} from './contract';
import AboutModal from './ui/AboutModal';
import CategoryBuilder from './ui/CategoryBuilder';
import ChartArea from './ui/ChartArea';
import FilterPanel from './ui/FilterPanel';
import { fmtInt, isDateCol } from './ui/format';
import Notices from './ui/Notices';
import Sidebar from './ui/Sidebar';
import TopBar from './ui/TopBar';
import { useTheme } from './ui/theme';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; ds: Dataset };

/**
 * Repair a view against the current groupings and lens:
 * - grouping refs that no longer exist fall back (x -> lens date, series -> none)
 * - filters keyed on missing groupings are dropped
 * - a date-column x always tracks the lens date field
 * Returns the same object when nothing changed so setState can bail out.
 */
function sanitizeView(v: ViewState, groupings: Grouping[]): ViewState {
  const ids = new Set(groupings.map((g) => g.id));
  const dateField = LENS_INFO[v.lens].dateField;
  let changed = false;

  let x = v.x;
  if (!x) {
    x = { kind: 'col', col: dateField };
    changed = true;
  } else if (x.kind === 'grouping' && !ids.has(x.groupingId)) {
    x = { kind: 'col', col: dateField };
    changed = true;
  } else if (x.kind === 'col' && isDateCol(x.col) && x.col !== dateField) {
    x = { kind: 'col', col: dateField };
    changed = true;
  }

  let series = v.series;
  if (series && series.kind === 'grouping' && !ids.has(series.groupingId)) {
    series = null;
    changed = true;
  }

  let filters = v.filters;
  const badKeys = Object.keys(filters).filter(
    (k) => k.startsWith('g:') && !ids.has(k.slice(2)),
  );
  if (badKeys.length > 0) {
    filters = { ...filters };
    for (const k of badKeys) delete filters[k];
    changed = true;
  }

  return changed ? { ...v, x, series, filters } : v;
}

function initialView(): ViewState {
  try {
    const h = location.hash.replace(/^#/, '');
    if (h) {
      const v = decodeView(h);
      if (v) return v;
    }
  } catch {
    /* fall through to default */
  }
  return DEFAULT_VIEW;
}

export default function App() {
  const { mode, palette, toggle: toggleTheme } = useTheme();

  // ---- dataset ----
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const startedRef = useRef(false);
  const reload = useCallback(() => {
    setLoad({ status: 'loading' });
    loadDataset(DATA_URL)
      .then((ds: Dataset) => setLoad({ status: 'ready', ds }))
      .catch((e: unknown) =>
        setLoad({ status: 'error', message: e instanceof Error ? e.message : String(e) }),
      );
  }, []);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    reload();
  }, [reload]);

  // ---- groupings ----
  const [userGroupings, setUserGroupings] = useState<Grouping[]>(() => {
    try {
      return loadGroupings();
    } catch {
      return [];
    }
  });
  const effectiveGroupings = useMemo(() => {
    const byId = new Map<string, Grouping>();
    for (const g of PRESET_GROUPINGS as Grouping[]) byId.set(g.id, g);
    for (const g of userGroupings) byId.set(g.id, g);
    return [...byId.values()];
  }, [userGroupings]);
  const handleSaveGroupings = useCallback((next: Grouping[]) => {
    setUserGroupings(next);
    try {
      saveGroupings(next);
    } catch {
      /* localStorage full or blocked; state still updates */
    }
  }, []);

  // ---- view state ----
  const [view, setView] = useState<ViewState>(() =>
    sanitizeView(initialView(), effectiveGroupings),
  );
  useEffect(() => {
    setView((v) => sanitizeView(v, effectiveGroupings));
  }, [effectiveGroupings]);

  const patch = useCallback((p: Partial<ViewState>) => {
    setView((v) => ({ ...v, ...p }));
  }, []);

  const onLens = useCallback((lens: Lens) => {
    setView((v) => {
      const next = { ...v, lens };
      return sanitizeView(next, effectiveGroupings);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveGroupings]);

  const setFilter = useCallback((key: string, values: string[]) => {
    setView((v) => {
      const filters = { ...v.filters };
      if (values.length > 0) filters[key] = values;
      else delete filters[key];
      return { ...v, filters };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setView((v) => ({ ...v, filters: {}, dateFrom: null, dateTo: null }));
  }, []);

  // ---- URL sync ----
  useEffect(() => {
    try {
      const encoded = encodeView(view);
      const hash = encoded.startsWith('#') ? encoded : `#${encoded}`;
      history.replaceState(null, '', hash);
    } catch {
      /* never break the app over a URL */
    }
  }, [view]);

  // A shared link pasted into an already-open tab changes only the hash and
  // never reloads the page; apply it here. replaceState above does not fire
  // hashchange, so this only reacts to outside navigation.
  useEffect(() => {
    const onHash = () => {
      try {
        const h = location.hash.replace(/^#/, '');
        if (!h) return;
        const v = decodeView(h);
        if (v) setView(sanitizeView(v, effectiveGroupings));
      } catch {
        /* malformed hash; keep the current view */
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [effectiveGroupings]);

  // ---- aggregation + notices ----
  const { agg, aggError } = useMemo<{ agg: AggResult | null; aggError: string | null }>(() => {
    if (load.status !== 'ready') return { agg: null, aggError: null };
    try {
      return { agg: aggregate(load.ds, view, effectiveGroupings), aggError: null };
    } catch (e) {
      return { agg: null, aggError: e instanceof Error ? e.message : String(e) };
    }
  }, [load, view, effectiveGroupings]);

  const notices = useMemo<Notice[]>(() => {
    try {
      return noticesFor(view, effectiveGroupings);
    } catch {
      return [];
    }
  }, [view, effectiveGroupings]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const dismissNotice = useCallback((title: string) => {
    setDismissed((s) => new Set(s).add(title));
  }, []);

  // ---- chrome state ----
  const [filtersOpen, setFiltersOpen] = useState(() => window.innerWidth > 1100);
  const [showTable, setShowTable] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, []);

  const downloadCsv = useCallback(() => {
    if (!agg) return;
    try {
      const csv = aggToCsv(agg, view);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `suffolk-${view.lens}-${view.measure}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* engine not ready or serialization failed; button does nothing */
    }
  }, [agg, view]);

  const filterCount =
    Object.values(view.filters).filter((v) => v && v.length > 0).length +
    (view.dateFrom || view.dateTo ? 1 : 0);

  const status =
    load.status === 'loading'
      ? 'Loading…'
      : load.status === 'error'
        ? 'Load failed'
        : agg
          ? `${fmtInt(agg.filteredRowCount)} of ${fmtInt(load.ds.rowCount)} charges`
          : `${fmtInt(load.ds.rowCount)} charges`;

  return (
    <div className="app">
      <TopBar
        status={status}
        mode={mode}
        onToggleTheme={toggleTheme}
        onCopyLink={copyLink}
        copied={copied}
        onCsv={downloadCsv}
        csvEnabled={agg !== null}
        onCategories={() => setShowBuilder(true)}
        onAbout={() => setShowAbout(true)}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        filterCount={filterCount}
      />

      {load.status === 'loading' && (
        <div className="fullpanel">
          <span className="wordmark loading" aria-hidden>
            <i />
            <i />
            <i />
          </span>
          <h2>Loading the dataset</h2>
          <p>Fetching and decoding hayden.parquet, 200,630 charge rows. Runs entirely in your browser.</p>
        </div>
      )}

      {load.status === 'error' && (
        <div className="fullpanel">
          <h2 className="error-title">The dataset failed to load</h2>
          <p className="error-detail">{load.message}</p>
          <button className="btn btn-primary" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {load.status === 'ready' && (
        <div className="app-body">
          <Sidebar view={view} groupings={effectiveGroupings} onPatch={patch} onLens={onLens} />
          <main className="main">
            <Notices notices={notices} dismissed={dismissed} onDismiss={dismissNotice} />
            <ChartArea
              agg={agg}
              aggError={aggError}
              view={view}
              groupings={effectiveGroupings}
              palette={palette}
              mode={mode}
              showTable={showTable}
              onToggleTable={() => setShowTable((s) => !s)}
            />
          </main>
          {filtersOpen && (
            <FilterPanel
              ds={load.ds}
              view={view}
              groupings={effectiveGroupings}
              onSetFilter={setFilter}
              onPatch={patch}
              onClearAll={clearAllFilters}
              onClose={() => setFiltersOpen(false)}
            />
          )}
        </div>
      )}

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
      {showBuilder && load.status === 'ready' && (
        <CategoryBuilder
          ds={load.ds}
          userGroupings={userGroupings}
          presets={PRESET_GROUPINGS as Grouping[]}
          onSaveAll={handleSaveGroupings}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
