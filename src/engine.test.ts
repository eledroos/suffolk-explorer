/**
 * Engine tests against the real parquet and the verified ground truth in
 * DESIGN.md ("Acceptance checks"). Runs under node; loadDataset falls back
 * to hyparquet's asyncBufferFromFile for non-http paths.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW,
  MAX_SERIES,
  type Dataset,
  type Grouping,
  type ViewState,
} from './contract';
import {
  loadDataset,
  aggregate,
  distinctValues,
  noticesFor,
  encodeView,
  decodeView,
  loadGroupings,
  saveGroupings,
  PRESET_GROUPINGS,
  aggToCsv,
} from './engine';

// file URL -> filesystem path without needing @types/node (repo path has spaces)
const PARQUET_PATH = decodeURIComponent(
  new URL('../public/data/hayden.parquet', import.meta.url).pathname,
);

function view(overrides: Partial<ViewState>): ViewState {
  return { ...DEFAULT_VIEW, filters: {}, ...overrides };
}

function valuesByX(rows: { x: string; value: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.x] = (out[r.x] ?? 0) + r.value;
  return out;
}

let ds: Dataset;

beforeAll(async () => {
  ds = await loadDataset(PARQUET_PATH);
}, 120_000);

describe('loadDataset', () => {
  it('reads all 200,630 rows', () => {
    expect(ds.rowCount).toBe(200_630);
    expect(ds.cats.filed_under.codes.length).toBe(200_630);
    expect(ds.dates.filing_date.length).toBe(200_630);
    expect(ds.bools.filed_in_window.length).toBe(200_630);
    expect(ds.ids.case_id.length).toBe(200_630);
    expect(ds.cats.charge_description.codes.length).toBe(200_630);
    expect(ds.cats.dtp_class.dict.length).toBeGreaterThanOrEqual(4);
  });
});

describe('aggregate: verified ground truth', () => {
  it('filings lens, yearly charges', () => {
    const r = aggregate(
      ds,
      view({ lens: 'filings', granularity: 'year', x: { kind: 'col', col: 'filing_date' } }),
      [],
    );
    expect(valuesByX(r.rows)).toEqual({
      '2022': 37_399,
      '2023': 39_260,
      '2024': 43_880,
      '2025': 40_595,
    });
    expect(r.xOrder).toEqual(['2022', '2023', '2024', '2025']); // chronological
    expect(r.total).toBe(161_134);
    expect(r.filteredRowCount).toBe(161_134);
  });

  it('dispositions lens, yearly charges', () => {
    const r = aggregate(
      ds,
      view({
        lens: 'dispositions',
        granularity: 'year',
        x: { kind: 'col', col: 'disposition_date' },
      }),
      [],
    );
    expect(valuesByX(r.rows)).toEqual({
      '2022': 37_091,
      '2023': 38_536,
      '2024': 41_146,
      '2025': 37_147,
    });
    expect(r.total).toBe(153_920);
  });

  it('filed_under on lens=all with no window filter', () => {
    const r = aggregate(ds, view({ lens: 'all', x: { kind: 'col', col: 'filed_under' } }), []);
    expect(valuesByX(r.rows)).toEqual({
      Hayden: 160_036,
      Rollins: 36_045,
      Conley: 4_549,
    });
    expect(r.total).toBe(200_630);
    expect(r.filteredRowCount).toBe(200_630);
    expect(r.xOrder).toEqual(['Hayden', 'Rollins', 'Conley']); // descending by value
  });
});

describe('aggregate: measures and filters', () => {
  it('distinct cases for filings 2022 matches an independent computation', () => {
    const r = aggregate(
      ds,
      view({
        lens: 'filings',
        granularity: 'year',
        x: { kind: 'col', col: 'filing_date' },
        measure: 'cases',
      }),
      [],
    );
    const byYear = valuesByX(r.rows);

    // Independent: distinct case_id among filed_in_window rows filed in 2022.
    const flags = ds.bools.filed_in_window;
    const days = ds.dates.filing_date;
    const caseIds = ds.ids.case_id;
    const set = new Set<number>();
    for (let i = 0; i < ds.rowCount; i++) {
      if (!flags[i]) continue;
      if (new Date(days[i] * 86400000).getUTCFullYear() !== 2022) continue;
      set.add(caseIds[i]);
    }
    expect(byYear['2022']).toBe(set.size);
    expect(set.size).toBeGreaterThan(0);
    expect(set.size).toBeLessThan(37_399); // fewer cases than charges
  });

  it('date range filter narrows the filings cohort to one year', () => {
    const r = aggregate(
      ds,
      view({
        lens: 'filings',
        granularity: 'year',
        x: { kind: 'col', col: 'filing_date' },
        dateFrom: '2023-01-01',
        dateTo: '2023-12-31',
      }),
      [],
    );
    expect(valuesByX(r.rows)).toEqual({ '2023': 39_260 });
  });

  it('column filter values are dictionary strings', () => {
    const r = aggregate(
      ds,
      view({
        lens: 'all',
        x: { kind: 'col', col: 'filed_under' },
        filters: { filed_under: ['Hayden', 'Conley'] },
      }),
      [],
    );
    expect(valuesByX(r.rows)).toEqual({ Hayden: 160_036, Conley: 4_549 });
    expect(r.total).toBe(164_585);
  });

  it('monthly granularity buckets chronologically as YYYY-MM', () => {
    const r = aggregate(
      ds,
      view({ lens: 'filings', granularity: 'month', x: { kind: 'col', col: 'filing_date' } }),
      [],
    );
    expect(r.xOrder.length).toBe(48); // Jan 2022 - Dec 2025
    expect(r.xOrder[0]).toBe('2022-01');
    expect(r.xOrder[47]).toBe('2025-12');
    expect(r.rows.reduce((a, b) => a + b.value, 0)).toBe(161_134);
  });
});

describe('aggregate: groupings', () => {
  it('grouping as x sums to the same total as ungrouped', () => {
    const grouped = aggregate(
      ds,
      view({
        lens: 'dispositions',
        x: { kind: 'grouping', groupingId: 'preset_disposition_family' },
      }),
      PRESET_GROUPINGS,
    );
    const ungrouped = aggregate(
      ds,
      view({
        lens: 'dispositions',
        granularity: 'year',
        x: { kind: 'col', col: 'disposition_date' },
      }),
      [],
    );
    const sum = grouped.rows.reduce((a, b) => a + b.value, 0);
    expect(sum).toBe(ungrouped.total);
    expect(grouped.total).toBe(ungrouped.total);
    const buckets = grouped.rows.map((r) => r.x).sort();
    expect(buckets).toEqual(
      ['Diversion-type', 'Dismissed-type', 'Other', 'Plea', 'Trial verdicts'].sort(),
    );
  });

  it('grouping as series with a bucket-name filter (g:<id>)', () => {
    const all = aggregate(
      ds,
      view({
        lens: 'dispositions',
        granularity: 'year',
        x: { kind: 'col', col: 'disposition_date' },
        series: { kind: 'grouping', groupingId: 'preset_disposition_family' },
      }),
      PRESET_GROUPINGS,
    );
    expect(all.rows.reduce((a, b) => a + b.value, 0)).toBe(153_920);
    expect(all.seriesOrder).toContain('Dismissed-type');

    const filtered = aggregate(
      ds,
      view({
        lens: 'dispositions',
        granularity: 'year',
        x: { kind: 'col', col: 'disposition_date' },
        filters: { 'g:preset_disposition_family': ['Plea'] },
      }),
      PRESET_GROUPINGS,
    );
    const pleaOnly = all.rows
      .filter((r) => r.series === 'Plea')
      .reduce((a, b) => a + b.value, 0);
    expect(filtered.total).toBe(pleaOnly);
    expect(filtered.total).toBeGreaterThan(0);
  });

  it('a view referencing a missing grouping falls back gracefully', () => {
    const r = aggregate(
      ds,
      view({ lens: 'all', x: { kind: 'grouping', groupingId: 'does_not_exist' } }),
      [],
    );
    expect(r.total).toBe(200_630);
    expect(r.xOrder).toEqual(['All']);
  });
});

describe('aggregate: MAX_SERIES fold', () => {
  it('folds crime_type (60 values) into at most 8 series without losing rows', () => {
    const r = aggregate(
      ds,
      view({
        lens: 'filings',
        granularity: 'year',
        x: { kind: 'col', col: 'filing_date' },
        series: { kind: 'col', col: 'crime_type' },
      }),
      [],
    );
    expect(r.seriesOrder.length).toBe(MAX_SERIES);
    expect(r.seriesOrder).toContain('Other');
    expect(r.rows.reduce((a, b) => a + b.value, 0)).toBe(161_134);
  });

  it('folds distinct measures by recomputing, not summing distincts', () => {
    const folded = aggregate(
      ds,
      view({
        lens: 'filings',
        granularity: 'year',
        x: { kind: 'col', col: 'filing_date' },
        series: { kind: 'col', col: 'crime_type' },
        measure: 'cases',
      }),
      [],
    );
    // The folded 'Other' cell can never exceed the distinct cases of the
    // whole x bucket, which a naive sum of distincts would.
    const unfolded = aggregate(
      ds,
      view({
        lens: 'filings',
        granularity: 'year',
        x: { kind: 'col', col: 'filing_date' },
        measure: 'cases',
      }),
      [],
    );
    const totals = valuesByX(unfolded.rows);
    for (const row of folded.rows) {
      expect(row.value).toBeLessThanOrEqual(totals[row.x]);
    }
    expect(folded.total).toBe(unfolded.total);
  });
});

describe('distinctValues', () => {
  it('is sorted and contains every preset bucket value verbatim', () => {
    const values = distinctValues(ds, 'disposition_description');
    expect(values).toEqual([...values].sort());
    for (const bucket of PRESET_GROUPINGS[0].buckets) {
      for (const v of bucket.values) expect(values).toContain(v);
    }
  });

  it('returns the three DAs for filed_under', () => {
    expect(distinctValues(ds, 'filed_under')).toEqual(['Conley', 'Hayden', 'Rollins']);
  });
});

describe('encodeView / decodeView', () => {
  it('round-trips a non-default view', () => {
    const v = view({
      lens: 'dispositions',
      chart: 'stackedBar',
      x: { kind: 'col', col: 'disposition_date' },
      series: { kind: 'grouping', groupingId: 'preset_disposition_family' },
      granularity: 'quarter',
      measure: 'cases',
      pct: true,
      filters: { court: ['Suffolk Superior Court', 'Dorchester Court'], 'g:preset_disposition_family': ['Plea'] },
      dateFrom: '2022-06-01',
      dateTo: '2024-09-30',
    });
    const token = encodeView(v);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // URL-hash safe, no escaping needed
    expect(decodeView(token)).toEqual(v);
  });

  it('round-trips the default view', () => {
    expect(decodeView(encodeView(DEFAULT_VIEW))).toEqual(DEFAULT_VIEW);
  });

  it('returns null on garbage and empty input', () => {
    expect(decodeView('!!!not-base64url!!!')).toBeNull();
    expect(decodeView(toToken('"just a string"'))).toBeNull();
    expect(decodeView('')).toBeNull();
    expect(decodeView('#')).toBeNull();
  });

  it('merges partial payloads with DEFAULT_VIEW for forward-compat', () => {
    const partial = toToken('{"lens":"all","someFutureField":123}');
    expect(decodeView(partial)).toEqual({ ...DEFAULT_VIEW, lens: 'all' });
  });
});

/** Encode a raw JSON string the way encodeView does, for decode-side tests. */
function toToken(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('noticesFor (DESIGN.md section 6)', () => {
  it('warns about missing Superior Court dispositions when the range touches Oct 2024', () => {
    const hits = noticesFor(view({ lens: 'dispositions' }), []);
    expect(hits.some((n) => n.level === 'warn' && n.detail.includes('Suffolk Superior'))).toBe(true);

    const before = noticesFor(view({ lens: 'dispositions', dateTo: '2024-09-30' }), []);
    expect(before.some((n) => n.detail.includes('Suffolk Superior'))).toBe(false);

    const otherCourt = noticesFor(
      view({ lens: 'dispositions', filters: { court: ['Dorchester Court'] } }),
      [],
    );
    expect(otherCourt.some((n) => n.detail.includes('Suffolk Superior'))).toBe(false);

    const superior = noticesFor(
      view({ lens: 'dispositions', filters: { court: ['Suffolk Superior Court'] } }),
      [],
    );
    expect(superior.some((n) => n.detail.includes('Suffolk Superior'))).toBe(true);
  });

  it('notes the 2025 sealed-case undercount only when filings touch 2025', () => {
    const hits = noticesFor(view({ lens: 'filings' }), []);
    expect(hits.some((n) => n.level === 'info' && n.detail.includes('sealed cases'))).toBe(true);

    const capped = noticesFor(view({ lens: 'filings', dateTo: '2024-12-31' }), []);
    expect(capped.some((n) => n.detail.includes('sealed cases'))).toBe(false);
  });

  it('warns about right-censoring when a filings series involves disposition fields', () => {
    const direct = noticesFor(
      view({ lens: 'filings', series: { kind: 'col', col: 'disposition_description' } }),
      [],
    );
    expect(direct.some((n) => n.level === 'warn' && n.detail.includes('right-censored'))).toBe(true);

    const viaGrouping = noticesFor(
      view({
        lens: 'filings',
        series: { kind: 'grouping', groupingId: 'preset_disposition_family' },
      }),
      PRESET_GROUPINGS,
    );
    expect(viaGrouping.some((n) => n.detail.includes('right-censored'))).toBe(true);

    const unrelated = noticesFor(
      view({ lens: 'filings', series: { kind: 'col', col: 'court' } }),
      [],
    );
    expect(unrelated.some((n) => n.detail.includes('right-censored'))).toBe(false);
  });

  it('notes the Jan 3, 2022 window start only when dispositions touch Jan 2022', () => {
    const hits = noticesFor(view({ lens: 'dispositions' }), []);
    expect(hits.some((n) => n.level === 'info' && n.detail.includes('Jan 3, 2022'))).toBe(true);

    const later = noticesFor(view({ lens: 'dispositions', dateFrom: '2022-02-01' }), []);
    expect(later.some((n) => n.detail.includes('Jan 3, 2022'))).toBe(false);
  });
});

describe('groupings persistence', () => {
  it('is a no-op outside the browser', () => {
    expect(loadGroupings()).toEqual([]);
    expect(() => saveGroupings(PRESET_GROUPINGS)).not.toThrow();
  });

  it('ships the disposition-family preset', () => {
    expect(PRESET_GROUPINGS).toHaveLength(1);
    expect(PRESET_GROUPINGS[0].id).toBe('preset_disposition_family');
    expect(PRESET_GROUPINGS[0].column).toBe('disposition_description');
    expect(PRESET_GROUPINGS[0].otherLabel).toBe('Other');
  });
});

describe('aggToCsv', () => {
  it('writes a header from the view and RFC-quotes fields', () => {
    const v = view({
      lens: 'all',
      x: { kind: 'col', col: 'filed_under' },
      series: { kind: 'col', col: 'court' },
    });
    const csv = aggToCsv(
      {
        rows: [
          { x: 'Hayden', series: 'Boston Municipal Court', value: 10 },
          { x: 'He said "no", twice', series: null, value: 2 },
        ],
        xOrder: [],
        seriesOrder: [],
        total: 12,
        filteredRowCount: 12,
      },
      v,
    );
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Filed under (DA),Court,Charges');
    expect(lines[1]).toBe('Hayden,Boston Municipal Court,10');
    expect(lines[2]).toBe('"He said ""no"", twice",,2');
  });

  it('omits the series column when the view has no series dim', () => {
    const r = aggregate(
      ds,
      view({ lens: 'all', x: { kind: 'col', col: 'filed_under' } }),
      [],
    );
    const csv = aggToCsv(r, view({ lens: 'all', x: { kind: 'col', col: 'filed_under' } }));
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Filed under (DA),Charges');
    expect(lines).toHaveLength(4); // header + three DAs
    expect(lines[1]).toBe('Hayden,160036');
  });
});
