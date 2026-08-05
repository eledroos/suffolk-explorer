import type { AggResult } from '../contract';

/** Wide-format datum for recharts. `__x` is the category key; series values are numeric fields. */
export interface WideDatum {
  __x: string;
  [key: string]: string | number;
}

/** Key used when there is no series dimension. */
export const SINGLE_KEY = '__value';

export function hasSeries(agg: AggResult): boolean {
  if (agg.rows.length > 0) return agg.rows[0].series !== null;
  return agg.seriesOrder.length > 0;
}

/**
 * Long AggResult -> wide recharts data. Missing (x, series) combinations are
 * filled with 0 so stacked charts do not tear.
 */
export function toWide(agg: AggResult): { data: WideDatum[]; seriesKeys: string[] } {
  const withSeries = hasSeries(agg);
  const keys = withSeries ? agg.seriesOrder : [SINGLE_KEY];
  const byX = new Map<string, WideDatum>();
  for (const x of agg.xOrder) {
    const d: WideDatum = { __x: x };
    for (const k of keys) d[k] = 0;
    byX.set(x, d);
  }
  for (const r of agg.rows) {
    let d = byX.get(r.x);
    if (!d) {
      d = { __x: r.x };
      for (const k of keys) d[k] = 0;
      byX.set(r.x, d);
    }
    d[r.series === null ? SINGLE_KEY : r.series] = r.value;
  }
  const order = agg.xOrder.length > 0 ? agg.xOrder : [...byX.keys()];
  return { data: order.map((x) => byX.get(x)!), seriesKeys: keys };
}

/**
 * Percent-of-total transform for line and grouped-bar charts.
 * With a series dimension: each value becomes its share across series at that x.
 * Without one: each value becomes its share of the filtered total.
 * Values are 0-100.
 */
export function toPctData(data: WideDatum[], keys: string[], total: number): WideDatum[] {
  return data.map((d) => {
    const out: WideDatum = { __x: d.__x };
    let base: number;
    if (keys.length > 1) {
      base = keys.reduce((acc, k) => acc + (typeof d[k] === 'number' ? (d[k] as number) : 0), 0);
    } else {
      base = total;
    }
    for (const k of keys) {
      const v = typeof d[k] === 'number' ? (d[k] as number) : 0;
      out[k] = base > 0 ? (v / base) * 100 : 0;
    }
    return out;
  });
}

/** Map of `x -> series -> value` for heatmap and pivot lookups. */
export function valueGrid(agg: AggResult): Map<string, Map<string | null, number>> {
  const m = new Map<string, Map<string | null, number>>();
  for (const r of agg.rows) {
    let inner = m.get(r.x);
    if (!inner) {
      inner = new Map();
      m.set(r.x, inner);
    }
    inner.set(r.series, r.value);
  }
  return m;
}

/**
 * Percent-of-baseline transform for pctDenom === 'lens'. Each value becomes
 * its share (0-100) of the UNFILTERED lens total for its x bucket.
 */
export function toPctOfBaseline(
  data: WideDatum[],
  keys: string[],
  baseline: Record<string, number>,
): WideDatum[] {
  return data.map((d) => {
    const out: WideDatum = { __x: d.__x };
    const base = baseline[d.__x] ?? 0;
    for (const k of keys) {
      const v = typeof d[k] === 'number' ? (d[k] as number) : 0;
      out[k] = base > 0 ? (v / base) * 100 : 0;
    }
    return out;
  });
}
