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
  bandsFor,
  fmtMonth,
  mergeDatasets,
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
  HISTORY_DATA_URL,
} from './contract';
import AboutModal from './ui/AboutModal';
import CategoryBuilder from './ui/CategoryBuilder';
import ChartArea from './ui/ChartArea';
import FilterPanel from './ui/FilterPanel';
import { colLabel, fmtInt, isDateCol, viewTitle } from './ui/format';
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
    setView((v) => {
      // Re-clicking an already-active control is a no-op: keep the same view
      // identity so display state (legend isolation) is not reset.
      let changed = false;
      for (const k of Object.keys(p) as (keyof ViewState)[]) {
        if (JSON.stringify(v[k]) !== JSON.stringify(p[k])) {
          changed = true;
          break;
        }
      }
      return changed ? { ...v, ...p } : v;
    });
  }, []);

  const onLens = useCallback((lens: Lens) => {
    setView((v) => {
      if (v.lens === lens) return v;
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
  // ---- 2006-2021 history: lazy-loaded second parquet, merged on demand ----
  const [histDs, setHistDs] = useState<Dataset | null>(null);
  const [histLoading, setHistLoading] = useState(false);
  const histInFlight = useRef(false); // ref, not state: survives StrictMode double-invoke
  const mergedRef = useRef<{ hist: Dataset; merged: Dataset } | null>(null);
  useEffect(() => {
    if (!view.history || histDs || histInFlight.current) return;
    histInFlight.current = true;
    setHistLoading(true);
    loadDataset(HISTORY_DATA_URL)
      .then((ds: Dataset) => setHistDs(ds))
      .catch((e: unknown) => {
        window.alert(
          `Loading the 2006-2021 history failed: ${e instanceof Error ? e.message : String(e)}.`,
        );
        patch({ history: false });
      })
      .finally(() => {
        histInFlight.current = false;
        setHistLoading(false);
      });
  }, [view.history, histDs, patch]);

  const activeDs = useMemo<Dataset | null>(() => {
    if (load.status !== 'ready') return null;
    if (view.history && histDs) {
      // cache the merge so re-toggling history is free
      if (mergedRef.current?.hist !== histDs) {
        mergedRef.current = { hist: histDs, merged: mergeDatasets(load.ds, histDs) };
      }
      return mergedRef.current.merged;
    }
    return load.ds;
  }, [load, view.history, histDs]);

  const { agg, aggError } = useMemo<{ agg: AggResult | null; aggError: string | null }>(() => {
    if (!activeDs) return { agg: null, aggError: null };
    if (view.history && !histDs) return { agg: null, aggError: null }; // still fetching
    try {
      return { agg: aggregate(activeDs, view, effectiveGroupings), aggError: null };
    } catch (e) {
      return { agg: null, aggError: e instanceof Error ? e.message : String(e) };
    }
  }, [activeDs, histDs, view, effectiveGroupings]);

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
      // The caveats travel with the data: view, filters, and any active
      // data-quality notices ride along as # comment lines.
      const stamp = new Date().toISOString().slice(0, 10);
      const header: string[] = [
        `# Suffolk DA Explorer export, generated ${stamp}`,
        `# View: ${viewTitle(view, effectiveGroupings)} (${LENS_INFO[view.lens].label} lens)`,
      ];
      const filterParts: string[] = [];
      for (const [key, vals] of Object.entries(view.filters)) {
        if (!vals || vals.length === 0) continue;
        const name = key.startsWith('g:')
          ? effectiveGroupings.find((g) => g.id === key.slice(2))?.name ?? 'Custom grouping'
          : colLabel(key);
        filterParts.push(`${name} = ${vals.join(' | ')}`);
      }
      if (view.dateFrom || view.dateTo) {
        filterParts.push(
          `${colLabel(LENS_INFO[view.lens].dateField)} ${view.dateFrom ?? 'start'} to ${view.dateTo ?? 'end'}`,
        );
      }
      header.push(`# Filters: ${filterParts.length > 0 ? filterParts.join('; ') : 'none'}`);
      for (const n of notices) {
        header.push(`# ${n.level === 'warn' ? 'Caution' : 'Note'}: ${n.title}. ${n.detail}`);
      }
      for (const b of bandsFor(view, effectiveGroupings)) {
        // banner-backed entries already carried their detail in a Caution/Note line
        header.push(
          `# Coverage band (${b.severity}): ${b.short}, ${fmtMonth(b.from)} - ${fmtMonth(b.to)}.${b.banner ? '' : ` ${b.detail}`}`,
        );
      }
      const csv = `${header.join('\n')}\n${aggToCsv(agg, view)}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `suffolk-${view.lens}-${view.measure}-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      window.alert(
        `The CSV export failed: ${e instanceof Error ? e.message : String(e)}. Try again, or reload the page.`,
      );
    }
  }, [agg, view, effectiveGroupings, notices]);

  // Badge counts individual filter values (matching the chips), plus the
  // date range as one.
  const filterCount =
    Object.values(view.filters).reduce((acc, v) => acc + (v ? v.length : 0), 0) +
    (view.dateFrom || view.dateTo ? 1 : 0);

  const lensCounts = useMemo<Record<Lens, number>>(() => {
    if (!activeDs) return { filings: 0, dispositions: 0, all: 0 };
    const ds = activeDs;
    let filed = 0, disp = 0;
    const f = ds.bools.filed_in_window, d = ds.bools.disposed_in_window;
    for (let i = 0; i < ds.rowCount; i++) { if (f[i]) filed++; if (d[i]) disp++; }
    return { filings: filed, dispositions: disp, all: ds.rowCount };
  }, [activeDs]);

  const status =
    load.status === 'loading'
      ? 'Loading…'
      : load.status === 'error'
        ? 'Load failed'
        : agg
          ? `${fmtInt(agg.filteredRowCount)} of ${fmtInt(activeDs?.rowCount ?? load.ds.rowCount)} charge rows`
          : `${fmtInt(activeDs?.rowCount ?? load.ds.rowCount)} charge rows`;

  return (
    <div className="app">
      <div className="brandstrip">
        <span>
          a{' '}
          <a href="https://bigdreams.info" target="_blank" rel="noopener noreferrer">
            BIG DREAMS
          </a>{' '}
          project
        </span>
      </div>
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
          <p>Getting the charge data ready.</p>
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
          <Sidebar view={view} lensCounts={lensCounts} historyLoading={histLoading} historyReady={histDs !== null} groupings={effectiveGroupings} onPatch={patch} onLens={onLens} />
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
              ds={activeDs ?? load.ds}
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
          ds={activeDs ?? load.ds}
          userGroupings={userGroupings}
          presets={PRESET_GROUPINGS as Grouping[]}
          onSaveAll={handleSaveGroupings}
          onClose={() => setShowBuilder(false)}
        />
      )}
    </div>
  );
}
