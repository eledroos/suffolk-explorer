/**
 * aggregate(): lens window + date range + column/grouping filters, then
 * group by x dim and series dim with the selected measure.
 */
import {
  COLUMNS,
  LENS_INFO,
  MAX_SERIES,
  type AggResult,
  type AggRow,
  type ColKind,
  type Dataset,
  type Dim,
  type Granularity,
  type Grouping,
  type ViewState,
} from '../contract';
import { NULL_DATE } from './load';

const KIND_BY_NAME: ReadonlyMap<string, ColKind> = new Map(
  COLUMNS.map((c) => [c.name, c.kind]),
);

/** Label used for null cell values in a categorical dimension. */
export const NULL_LABEL = '(none)';
/** Label of the folded remainder when a series dim exceeds MAX_SERIES. */
export const OTHER_SERIES = 'Other';

/** 'YYYY-MM-DD' -> days since epoch, or null when unparsable. */
function dayFromISO(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  return Math.round(t / 86400000);
}

/** Memoized day-number -> time-bucket label for the given granularity. */
function timeLabeler(gran: Granularity): (day: number) => string {
  const memo = new Map<number, string>();
  return (day) => {
    let label = memo.get(day);
    if (label === undefined) {
      const d = new Date(day * 86400000);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      label =
        gran === 'year'
          ? String(y)
          : gran === 'quarter'
            ? `${y}-Q${Math.floor((m - 1) / 3) + 1}`
            : `${y}-${String(m).padStart(2, '0')}`;
      memo.set(day, label);
    }
    return label;
  };
}

interface DimResolver {
  get: (row: number) => string;
  isTime: boolean;
  /** When set, rows with a NULL_DATE in this array are excluded up front. */
  dateArr: Int32Array | null;
}

const CONSTANT_DIM: DimResolver = { get: () => 'All', isTime: false, dateArr: null };

function resolveDim(
  ds: Dataset,
  dim: Dim | null,
  gran: Granularity,
  groupings: Grouping[],
): DimResolver {
  if (!dim) return CONSTANT_DIM;

  if (dim.kind === 'grouping') {
    const g = groupings.find((x) => x.id === dim.groupingId);
    if (!g) return CONSTANT_DIM; // missing grouping: fall back gracefully
    const cat = ds.cats[g.column];
    if (!cat) return CONSTANT_DIM;
    const other = g.otherLabel || 'Other';
    const valueToBucket = new Map<string, string>();
    for (const b of g.buckets) for (const v of b.values) if (!valueToBucket.has(v)) valueToBucket.set(v, b.name);
    // Precompute code -> bucket label; null code (-1) is unassigned -> other.
    const byCode = cat.dict.map((v) => valueToBucket.get(v) ?? other);
    const codes = cat.codes;
    return { get: (i) => (codes[i] < 0 ? other : byCode[codes[i]]), isTime: false, dateArr: null };
  }

  const col = dim.col;
  const kind = KIND_BY_NAME.get(col);
  if (kind === 'date') {
    const arr = ds.dates[col];
    if (!arr) return CONSTANT_DIM;
    const label = timeLabeler(gran);
    return { get: (i) => label(arr[i]), isTime: true, dateArr: arr };
  }
  if (kind === 'cat') {
    const cat = ds.cats[col];
    if (!cat) return CONSTANT_DIM;
    const { dict, codes } = cat;
    return { get: (i) => (codes[i] < 0 ? NULL_LABEL : dict[codes[i]]), isTime: false, dateArr: null };
  }
  if (kind === 'bool') {
    const arr = ds.bools[col];
    if (!arr) return CONSTANT_DIM;
    return { get: (i) => (arr[i] ? 'true' : 'false'), isTime: false, dateArr: null };
  }
  if (kind === 'id' || kind === 'int') {
    const arr = ds.ids[col];
    if (!arr) return CONSTANT_DIM;
    return { get: (i) => String(arr[i]), isTime: false, dateArr: null };
  }
  if (kind === 'text') {
    const arr = ds.text[col];
    if (!arr) return CONSTANT_DIM;
    return { get: (i) => arr[i] || NULL_LABEL, isTime: false, dateArr: null };
  }
  return CONSTANT_DIM;
}

type RowTest = (row: number) => boolean;

/** One test per active filter entry. Keys 'g:<groupingId>' filter on bucket names. */
function buildFilterTests(ds: Dataset, view: ViewState, groupings: Grouping[]): RowTest[] {
  const tests: RowTest[] = [];
  for (const [key, values] of Object.entries(view.filters ?? {})) {
    if (!Array.isArray(values) || values.length === 0) continue;
    if (key.startsWith('g:')) {
      const g = groupings.find((x) => x.id === key.slice(2));
      if (!g) continue; // missing grouping: filter is ignored
      const cat = ds.cats[g.column];
      if (!cat) continue;
      const other = g.otherLabel || 'Other';
      const selected = new Set(values);
      const valueToBucket = new Map<string, string>();
      for (const b of g.buckets) for (const v of b.values) if (!valueToBucket.has(v)) valueToBucket.set(v, b.name);
      const allowed = new Uint8Array(cat.dict.length);
      cat.dict.forEach((v, code) => {
        if (selected.has(valueToBucket.get(v) ?? other)) allowed[code] = 1;
      });
      const allowNull = selected.has(other); // null values are unassigned -> other bucket
      const codes = cat.codes;
      tests.push((i) => (codes[i] < 0 ? allowNull : allowed[codes[i]] === 1));
    } else {
      const cat = ds.cats[key];
      if (!cat) continue; // only cat columns are filterable
      const selected = new Set(values);
      const allowed = new Uint8Array(cat.dict.length);
      cat.dict.forEach((v, code) => {
        if (selected.has(v)) allowed[code] = 1;
      });
      const codes = cat.codes;
      tests.push((i) => codes[i] >= 0 && allowed[codes[i]] === 1);
    }
  }
  return tests;
}

/** Per-series accumulator. Sets are only kept for distinct measures. */
interface SeriesAcc {
  count: number;
  set: Set<number> | null;
  cells: Map<string, number>;
  cellSets: Map<string, Set<number>> | null;
}

function newAcc(distinct: boolean): SeriesAcc {
  return {
    count: 0,
    set: distinct ? new Set() : null,
    cells: new Map(),
    cellSets: distinct ? new Map() : null,
  };
}

export function aggregate(ds: Dataset, view: ViewState, groupings: Grouping[]): AggResult {
  const lens = LENS_INFO[view.lens] ?? LENS_INFO.filings;
  const windowFlag = lens.windowFlag ? (ds.bools[lens.windowFlag] ?? null) : null;
  const lensDates = ds.dates[lens.dateField] ?? null;
  const fromDay = dayFromISO(view.dateFrom);
  const toDay = dayFromISO(view.dateTo);

  const tests = buildFilterTests(ds, view, groupings);
  const xr = resolveDim(ds, view.x, view.granularity, groupings);
  const sr = view.series ? resolveDim(ds, view.series, view.granularity, groupings) : null;
  // Rows whose value for a date dimension is null cannot be placed on the
  // axis; exclude them from the filtered set so cells, totals, and pct agree.
  const requiredDates: Int32Array[] = [];
  if (xr.dateArr) requiredDates.push(xr.dateArr);
  if (sr?.dateArr) requiredDates.push(sr.dateArr);

  const distinct = view.measure !== 'charges';
  const idArr =
    view.measure === 'cases'
      ? (ds.ids.case_id ?? null)
      : view.measure === 'people'
        ? (ds.ids.person_id ?? null)
        : null;

  const bySeries = new Map<string, SeriesAcc>();
  const xCounts = new Map<string, number>();
  const xSets = distinct ? new Map<string, Set<number>>() : null;
  let filteredRowCount = 0;
  let totalCount = 0;
  const totalSet = distinct ? new Set<number>() : null;

  const n = ds.rowCount;

  // --- caseScope 'all': a case qualifies only if EVERY one of its rows in
  // the lens window + date range passes the filters. Chart encoding
  // (requiredDates) deliberately does not affect qualification, and with no
  // filters active every case qualifies, so the pass is skipped. The Both
  // lens is excluded: its split rows make per-case row sets ambiguous.
  let qualifying: Set<number> | null = null;
  if (view.measure === 'cases' && view.caseScope === 'all' && view.lens !== 'all' && idArr && tests.length > 0) {
    const totalPer = new Map<number, number>();
    const matchPer = new Map<number, number>();
    scopeRows: for (let i = 0; i < n; i++) {
      if (windowFlag && windowFlag[i] === 0) continue;
      if (fromDay !== null && (!lensDates || lensDates[i] < fromDay || lensDates[i] === NULL_DATE)) continue;
      if (toDay !== null && (!lensDates || lensDates[i] > toDay || lensDates[i] === NULL_DATE)) continue;
      const cid = idArr[i];
      totalPer.set(cid, (totalPer.get(cid) ?? 0) + 1);
      for (const test of tests) if (!test(i)) continue scopeRows;
      matchPer.set(cid, (matchPer.get(cid) ?? 0) + 1);
    }
    qualifying = new Set();
    for (const [cid, tot] of totalPer) if (matchPer.get(cid) === tot) qualifying.add(cid);
  }

  rows: for (let i = 0; i < n; i++) {
    if (windowFlag && windowFlag[i] === 0) continue;
    if (fromDay !== null && (!lensDates || lensDates[i] < fromDay || lensDates[i] === NULL_DATE)) continue;
    if (toDay !== null && (!lensDates || lensDates[i] > toDay || lensDates[i] === NULL_DATE)) continue;
    for (const test of tests) if (!test(i)) continue rows;
    if (qualifying !== null && !qualifying.has(idArr![i])) continue;
    for (const arr of requiredDates) if (arr[i] === NULL_DATE) continue rows;

    filteredRowCount++;
    const xL = xr.get(i);
    const sL = sr ? sr.get(i) : '';

    let acc = bySeries.get(sL);
    if (!acc) {
      acc = newAcc(distinct);
      bySeries.set(sL, acc);
    }
    if (distinct) {
      const id = idArr ? idArr[i] : 0;
      acc.set!.add(id);
      let cell = acc.cellSets!.get(xL);
      if (!cell) acc.cellSets!.set(xL, (cell = new Set()));
      cell.add(id);
      let xs = xSets!.get(xL);
      if (!xs) xSets!.set(xL, (xs = new Set()));
      xs.add(id);
      totalSet!.add(id);
    } else {
      acc.count++;
      acc.cells.set(xL, (acc.cells.get(xL) ?? 0) + 1);
      xCounts.set(xL, (xCounts.get(xL) ?? 0) + 1);
      totalCount++;
    }
  }

  // --- unfiltered per-x baseline for pctDenom==='lens' ---
  // Same lens window and date range, same x bucketing, NO value filters. Rows
  // that cannot be placed on the x axis are excluded from both sides.
  let xBaseline: Record<string, number> | undefined;
  if (view.pct && view.pctDenom === 'lens') {
    const baseCounts = new Map<string, number>();
    const baseSets = distinct ? new Map<string, Set<number>>() : null;
    for (let i = 0; i < n; i++) {
      if (windowFlag && windowFlag[i] === 0) continue;
      if (fromDay !== null && (!lensDates || lensDates[i] < fromDay || lensDates[i] === NULL_DATE)) continue;
      if (toDay !== null && (!lensDates || lensDates[i] > toDay || lensDates[i] === NULL_DATE)) continue;
      if (xr.dateArr && xr.dateArr[i] === NULL_DATE) continue;
      const xL = xr.get(i);
      if (distinct) {
        const id = idArr ? idArr[i] : 0;
        let bs = baseSets!.get(xL);
        if (!bs) baseSets!.set(xL, (bs = new Set()));
        bs.add(id);
      } else {
        baseCounts.set(xL, (baseCounts.get(xL) ?? 0) + 1);
      }
    }
    xBaseline = {};
    if (distinct) for (const [x, st] of baseSets!) xBaseline[x] = st.size;
    else for (const [x, c] of baseCounts) xBaseline[x] = c;
  }

  // --- x order: chronological for time, descending by value otherwise ---
  const xVal = (x: string): number => (distinct ? (xSets!.get(x)?.size ?? 0) : (xCounts.get(x) ?? 0));
  const xLabelSet = new Set<string>(distinct ? xSets!.keys() : xCounts.keys());
  if (xBaseline) for (const x of Object.keys(xBaseline)) xLabelSet.add(x);
  const xLabels = [...xLabelSet];
  const xOrder = xr.isTime
    ? xLabels.sort()
    : xLabels.sort((a, b) => xVal(b) - xVal(a) || (a < b ? -1 : a > b ? 1 : 0));

  // --- series folding + order ---
  const accVal = (a: SeriesAcc): number => (distinct ? a.set!.size : a.count);
  if (sr && bySeries.size > MAX_SERIES) {
    const sorted = [...bySeries.entries()].sort(
      (a, b) => accVal(b[1]) - accVal(a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    );
    const kept = sorted.slice(0, MAX_SERIES - 1);
    const tail = sorted.slice(MAX_SERIES - 1);
    // Fold the tail into 'Other'. A real series already named 'Other' merges
    // with the fold bucket (whether it was kept or in the tail).
    const keptOther = kept.find(([name]) => name === OTHER_SERIES);
    const target = keptOther ? keptOther[1] : newAcc(distinct);
    for (const [name, acc] of tail) {
      bySeries.delete(name);
      if (distinct) {
        for (const id of acc.set!) target.set!.add(id);
        for (const [x, cell] of acc.cellSets!) {
          let t = target.cellSets!.get(x);
          if (!t) target.cellSets!.set(x, (t = new Set()));
          for (const id of cell) t.add(id);
        }
      } else {
        target.count += acc.count;
        for (const [x, c] of acc.cells) target.cells.set(x, (target.cells.get(x) ?? 0) + c);
      }
    }
    bySeries.set(OTHER_SERIES, target);
  }
  const seriesOrder = sr
    ? [...bySeries.entries()]
        .sort((a, b) => accVal(b[1]) - accVal(a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
        .map(([name]) => name)
    : [];

  // --- materialize rows, x-major ---
  const out: AggRow[] = [];
  for (const x of xOrder) {
    if (!sr) {
      const acc = bySeries.get('');
      if (!acc) continue;
      const v = distinct ? (acc.cellSets!.get(x)?.size ?? 0) : (acc.cells.get(x) ?? 0);
      if (v > 0) out.push({ x, series: null, value: v });
      continue;
    }
    for (const s of seriesOrder) {
      const acc = bySeries.get(s)!;
      const v = distinct ? (acc.cellSets!.get(x)?.size ?? 0) : (acc.cells.get(x) ?? 0);
      if (v > 0) out.push({ x, series: s, value: v });
    }
  }

  return {
    rows: out,
    xOrder,
    seriesOrder,
    total: distinct ? totalSet!.size : totalCount,
    filteredRowCount,
    ...(xBaseline ? { xBaseline } : {}),
  };
}
