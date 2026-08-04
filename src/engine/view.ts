/**
 * ViewState <-> URL-hash codec. Compact JSON (default-equal fields omitted)
 * encoded as base64url, so the token needs no URL escaping. decodeView
 * returns null on garbage and merges partial payloads with DEFAULT_VIEW for
 * forward compatibility.
 */
import {
  DEFAULT_VIEW,
  LENS_INFO,
  MEASURES,
  type ChartType,
  type Dim,
  type Granularity,
  type Lens,
  type Measure,
  type ViewState,
} from '../contract';

const CHART_TYPES: ReadonlySet<string> = new Set([
  'line', 'bar', 'stackedBar', 'pctBar', 'area', 'heatmap', 'pivot', 'table',
]);
const GRANULARITIES: ReadonlySet<string> = new Set(['month', 'quarter', 'year']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): string {
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeView(view: ViewState): string {
  // Omit fields equal to the default; decode fills them back in.
  const compact: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_VIEW) as (keyof ViewState)[]) {
    const value = view[key];
    if (JSON.stringify(value) !== JSON.stringify(DEFAULT_VIEW[key])) compact[key] = value;
  }
  return toBase64Url(JSON.stringify(compact));
}

/** Undefined means "invalid"; null is an explicit, valid null. */
function sanitizeDim(d: unknown): Dim | null | undefined {
  if (d === null) return null;
  if (typeof d === 'object' && d !== null) {
    const o = d as Record<string, unknown>;
    if (o.kind === 'col' && typeof o.col === 'string') return { kind: 'col', col: o.col };
    if (o.kind === 'grouping' && typeof o.groupingId === 'string') {
      return { kind: 'grouping', groupingId: o.groupingId };
    }
  }
  return undefined;
}

function sanitizeFilters(f: unknown): Record<string, string[]> | undefined {
  if (typeof f !== 'object' || f === null || Array.isArray(f)) return undefined;
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(f as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const values = value.filter((v): v is string => typeof v === 'string');
    if (values.length > 0) out[key] = values;
  }
  return out;
}

export function decodeView(hash: string): ViewState | null {
  try {
    const token = (hash ?? '').replace(/^#/, '').trim();
    if (!token) return null;
    const parsed: unknown = JSON.parse(fromBase64Url(token));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const p = parsed as Record<string, unknown>;

    const view: ViewState = { ...DEFAULT_VIEW, filters: {} };
    if (typeof p.lens === 'string' && p.lens in LENS_INFO) view.lens = p.lens as Lens;
    if (typeof p.chart === 'string' && CHART_TYPES.has(p.chart)) view.chart = p.chart as ChartType;
    if ('x' in p) {
      const x = sanitizeDim(p.x);
      if (x !== undefined) view.x = x;
    }
    if ('series' in p) {
      const s = sanitizeDim(p.series);
      if (s !== undefined) view.series = s;
    }
    if (typeof p.granularity === 'string' && GRANULARITIES.has(p.granularity)) {
      view.granularity = p.granularity as Granularity;
    }
    if (typeof p.measure === 'string' && p.measure in MEASURES) view.measure = p.measure as Measure;
    if (typeof p.pct === 'boolean') view.pct = p.pct;
    const filters = sanitizeFilters(p.filters);
    if (filters !== undefined) view.filters = filters;
    if (p.dateFrom === null || (typeof p.dateFrom === 'string' && ISO_DATE.test(p.dateFrom))) {
      view.dateFrom = p.dateFrom as string | null;
    }
    if (p.dateTo === null || (typeof p.dateTo === 'string' && ISO_DATE.test(p.dateTo))) {
      view.dateTo = p.dateTo as string | null;
    }
    return view;
  } catch {
    return null;
  }
}
