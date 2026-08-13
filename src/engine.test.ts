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
  bandsFor,
  bandBuckets,
  mergeDatasets,
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

describe('pctDenom lens: percent-of-period baselines (adversarial ground truth from pandas)', () => {
  const YY = 'YY (decline list)';
  it('YY share of ALL filings by year: numerators and baselines exact', async () => {
    const view: ViewState = {
      ...DEFAULT_VIEW,
      lens: 'filings',
      granularity: 'year',
      x: { kind: 'col', col: 'filing_date' },
      pct: true,
      pctDenom: 'lens',
      filters: { dtp_class: [YY] },
    };
    const agg = aggregate(ds, view, []);
    expect(agg.xBaseline).toBeDefined();
    expect(agg.xBaseline!['2022']).toBe(37_399);
    expect(agg.xBaseline!['2023']).toBe(39_260);
    expect(agg.xBaseline!['2024']).toBe(43_880);
    expect(agg.xBaseline!['2025']).toBe(40_595);
    const val = (x: string) => agg.rows.find((r) => r.x === x)?.value ?? 0;
    expect(val('2022')).toBe(8_486);
    expect(val('2023')).toBe(9_168);
    expect(val('2024')).toBe(10_654);
    expect(val('2025')).toBe(10_798);
    // shares to 4 decimals, as computed independently in pandas
    expect((100 * val('2022')) / agg.xBaseline!['2022']).toBeCloseTo(22.6904, 3);
    expect((100 * val('2025')) / agg.xBaseline!['2025']).toBeCloseTo(26.5993, 3);
  });

  it('YY + Conclusively prosecutorial share of ALL dispositions by year', async () => {
    const view: ViewState = {
      ...DEFAULT_VIEW,
      lens: 'dispositions',
      granularity: 'year',
      x: { kind: 'col', col: 'disposition_date' },
      pct: true,
      pctDenom: 'lens',
      filters: { dtp_class: [YY], prosecutorial_call: ['Conclusively prosecutorial'] },
    };
    const agg = aggregate(ds, view, []);
    const val = (x: string) => agg.rows.find((r) => r.x === x)?.value ?? 0;
    // re-baselined 2026-08-12 after the 2026-08-08 classification fix (see ../assembled/README.md):
    // "Dismissed / Dismissed WO Prosecution (call)" and "Plea / Delinquent - Fine (call)" moved from
    // Uncertain to Conclusively prosecutorial in the Hayden file, so more YY dispositions now qualify.
    expect(val('2022')).toBe(3_854);
    expect(val('2023')).toBe(4_091);
    expect(val('2024')).toBe(4_334);
    expect(val('2025')).toBe(4_398);
    expect(agg.xBaseline!['2022']).toBe(37_091);
    expect(agg.xBaseline!['2023']).toBe(38_536);
    expect(agg.xBaseline!['2024']).toBe(41_146);
    expect(agg.xBaseline!['2025']).toBe(37_147);
  });

  it('categorical x: YY share per court, baseline = each court\'s unfiltered filings', async () => {
    const view: ViewState = {
      ...DEFAULT_VIEW,
      lens: 'filings',
      x: { kind: 'col', col: 'court' },
      pct: true,
      pctDenom: 'lens',
      filters: { dtp_class: [YY] },
    };
    const agg = aggregate(ds, view, []);
    const val = (x: string) => agg.rows.find((r) => r.x === x)?.value ?? 0;
    expect(val('Boston Municipal Court')).toBe(13_075);
    expect(agg.xBaseline!['Boston Municipal Court']).toBe(35_635);
    expect(val('Dorchester Court')).toBe(6_148);
    expect(agg.xBaseline!['Dorchester Court']).toBe(30_741);
  });

  it('distinct-cases measure: cases with a YY charge over all cases filed that year', async () => {
    const view: ViewState = {
      ...DEFAULT_VIEW,
      lens: 'filings',
      granularity: 'year',
      x: { kind: 'col', col: 'filing_date' },
      measure: 'cases',
      pct: true,
      pctDenom: 'lens',
      filters: { dtp_class: [YY] },
    };
    const agg = aggregate(ds, view, []);
    const val = (x: string) => agg.rows.find((r) => r.x === x)?.value ?? 0;
    expect(val('2022')).toBe(6_551);
    expect(agg.xBaseline!['2022']).toBe(17_727);
    expect(val('2023')).toBe(7_085);
    expect(agg.xBaseline!['2023']).toBe(18_928);
  });

  it('regression: pctDenom absent from an old URL decodes to view mode', () => {
    const legacy = encodeView({ ...DEFAULT_VIEW, pct: true });
    const decoded = decodeView(legacy);
    expect(decoded?.pct).toBe(true);
    expect(decoded?.pctDenom).toBe('view');
  });
});

describe('coverage bands (registry)', () => {
  it('bands and banners derive from one registry: superior gap active/inactive together', () => {
    const on = view({ lens: 'dispositions' });
    expect(bandsFor(on, []).map((b) => b.id)).toContain('superior-gap');
    expect(noticesFor(on, []).some((n) => n.title.includes('Superior'))).toBe(true);
    const capped = view({ lens: 'dispositions', dateTo: '2024-09-30' });
    expect(bandsFor(capped, []).map((b) => b.id)).not.toContain('superior-gap');
    expect(noticesFor(capped, []).some((n) => n.title.includes('Superior'))).toBe(false);
    const chelsea = view({ lens: 'dispositions', filters: { court: ['Chelsea Court'] } });
    expect(bandsFor(chelsea, []).map((b) => b.id)).not.toContain('superior-gap');
  });

  it('sealing haze on filings only; late-entry floor is band-only (no banner)', () => {
    const f = view({ lens: 'filings' });
    expect(bandsFor(f, []).map((b) => b.id)).toContain('sealing-2025');
    const d = view({ lens: 'dispositions' });
    const ids = bandsFor(d, []).map((b) => b.id);
    expect(ids).toContain('late-entry-floor');
    expect(noticesFor(d, []).some((n) => n.title.includes('floors'))).toBe(false);
  });


  it('regression: the superior banner range is capped at Dec 2025 (deliberate change from open-ended)', () => {
    const future = view({ lens: 'dispositions', dateFrom: '2026-01-01' });
    expect(noticesFor(future, []).some((n) => n.title.includes('Superior'))).toBe(false);
    expect(bandsFor(future, []).map((b) => b.id)).not.toContain('superior-gap');
  });

  it('bandBuckets snaps and flags partial edges', () => {
    const sup = { from: '2024-10', to: '2025-12' };
    expect(bandBuckets(sup, 'month')).toEqual({ start: '2024-10', end: '2025-12', startPartial: false, endPartial: false });
    expect(bandBuckets(sup, 'quarter')).toEqual({ start: '2024-Q4', end: '2025-Q4', startPartial: false, endPartial: false });
    expect(bandBuckets(sup, 'year')).toEqual({ start: '2024', end: '2025', startPartial: true, endPartial: false });
    const floor = { from: '2024-07', to: '2024-09' };
    expect(bandBuckets(floor, 'quarter')).toEqual({ start: '2024-Q3', end: '2024-Q3', startPartial: false, endPartial: false });
    expect(bandBuckets(floor, 'year')).toEqual({ start: '2024', end: '2024', startPartial: true, endPartial: true });
    const odd = { from: '2024-08', to: '2025-02' };
    expect(bandBuckets(odd, 'quarter')).toEqual({ start: '2024-Q3', end: '2025-Q1', startPartial: true, endPartial: true });
  });
});

describe('history dataset (2006-2021) merge', () => {
  it('merges and the yearly seam is continuous, ground-truth exact', async () => {
    const histPath = decodeURIComponent(
      new URL('../public/data/history.parquet', import.meta.url).pathname,
    );
    const hist = await loadDataset(histPath);
    expect(hist.rowCount).toBe(1_092_889);
    const merged = mergeDatasets(ds, hist);
    expect(merged.rowCount).toBe(200_630 + 1_092_889);
    const v: ViewState = {
      ...DEFAULT_VIEW,
      history: true,
      granularity: 'year',
      x: { kind: 'col', col: 'filing_date' },
    };
    const agg = aggregate(merged, v, []);
    const val = (x: string) => agg.rows.find((r) => r.x === x)?.value ?? 0;
    // raw-extract years (verified against the Aug 3 audit's adult table;
    // the Oct 2021 pull differs from the May 2021 dashboard extract by a
    // handful of rows from sealing between pulls)
    expect(val('2016')).toBe(51_173);
    expect(val('2019')).toBe(46_014);
    expect(val('2020')).toBe(31_339);
    // dump year, corroborated by PRR-220211C to 0.3%
    expect(val('2021')).toBe(37_283);
    // Hayden era continues seamlessly
    expect(val('2022')).toBe(37_399);
    expect(val('2025')).toBe(40_595);
    const d = aggregate(merged, { ...v, lens: 'dispositions', x: { kind: 'col', col: 'disposition_date' } }, []);
    const dval = (x: string) => d.rows.find((r) => r.x === x)?.value ?? 0;
    expect(dval('2020')).toBe(20_667); // Oct 2021 pull caught +197 late entries over the May pull
    expect(dval('2021')).toBe(28_209);
    expect(dval('2022')).toBe(37_091);

    // Real IDs across the seam: distinct people dedupe between the composite
    // and the Hayden file (ground truth from duckdb over both CSVs; 2,375
    // people have filings in both 2021 and 2022).
    const people = (from: string, to: string) =>
      aggregate(
        merged,
        { ...v, measure: 'people' as const, dateFrom: from, dateTo: to },
        [],
      ).total; // distinct across the whole filtered view, not per-bucket
    expect(people('2021-01-01', '2021-12-31')).toBe(13_577);
    expect(people('2022-01-01', '2022-12-31')).toBe(14_156);
    // NOT 13,577 + 14,156 = 27,733: the overlap collapses
    expect(people('2021-01-01', '2022-12-31')).toBe(25_358);
  }, 120_000);

  it('history flag rides the URL; 2021 snapshot band gates on it', () => {
    const enc = encodeView({ ...DEFAULT_VIEW, history: true });
    expect(decodeView(enc)?.history).toBe(true);
    const histView = view({ lens: 'dispositions', history: true });
    expect(bandsFor(histView, []).map((b) => b.id)).toContain('disp-2021-snapshot');
    expect(bandsFor(view({ lens: 'dispositions' }), []).map((b) => b.id)).not.toContain('disp-2021-snapshot');
    // the window-open note yields to history
    expect(noticesFor(histView, []).some((n) => n.title.includes('Window opens'))).toBe(false);
    // Both-lens row inflation caveat gates on history
    const both = view({ lens: 'all', history: true });
    expect(noticesFor(both, []).some((n) => n.title.includes('counts rows'))).toBe(true);
    expect(noticesFor(view({ lens: 'all' }), []).some((n) => n.title.includes('counts rows'))).toBe(false);
    // distinct-across-seam retired 2026-08-05: real IDs dedupe across the
    // seam (asserted numerically in the merge test), so no view warns of it
    const cases = view({ lens: 'filings', history: true, measure: 'cases' });
    expect(noticesFor(cases, []).some((n) => n.title.includes('seam'))).toBe(false);
  });
});

describe('caseScope: any vs all (ground truth from duckdb over the CSV)', () => {
  const yy2023 = () =>
    view({
      measure: 'cases' as const,
      granularity: 'year' as const,
      filters: { dtp_class: ['YY (decline list)'] },
      dateFrom: '2023-01-01',
      dateTo: '2023-12-31',
    });

  it('filings 2023, dtp=YY: any=7,085 cases; all=3,361 pure-YY cases', () => {
    const anyAgg = aggregate(ds, yy2023(), []);
    expect(anyAgg.total).toBe(7_085);
    expect(anyAgg.filteredRowCount).toBe(9_168);
    const allAgg = aggregate(ds, { ...yy2023(), caseScope: 'all' }, []);
    expect(allAgg.total).toBe(3_361);
    // rows shown shrink to the qualifying cases' rows, all of which match
    expect(allAgg.filteredRowCount).toBe(4_398);
  });

  it('dispositions 2023, outcome=Office walk-away: any=8,377; all=7,522', () => {
    const base = view({
      lens: 'dispositions' as const,
      x: { kind: 'col' as const, col: 'disposition_date' },
      measure: 'cases' as const,
      granularity: 'year' as const,
      filters: { outcome_class: ['Office walk-away'] },
      dateFrom: '2023-01-01',
      dateTo: '2023-12-31',
    });
    // re-baselined 2026-08-12 after the 2026-08-08 classification fix (see ../assembled/README.md):
    // case 596471 (2 charge rows, disposed 2023-05-30) moved Office walk-away -> Administrative
    // ("Dismissed / Remanded to District Court" / "Dismissed Transfer to BJC"), dropping it from
    // both the any-set and the all-set.
    expect(aggregate(ds, base, []).total).toBe(8_377);
    expect(aggregate(ds, { ...base, caseScope: 'all' }, []).total).toBe(7_522);
  });

  it('scope is inert for charges measure, the Both lens, and empty filters', () => {
    const charges = { ...yy2023(), measure: 'charges' as const, caseScope: 'all' as const };
    expect(aggregate(ds, charges, []).total).toBe(aggregate(ds, { ...charges, caseScope: 'any' }, []).total);
    const both = { ...yy2023(), lens: 'all' as const, caseScope: 'all' as const };
    expect(aggregate(ds, both, []).total).toBe(aggregate(ds, { ...both, caseScope: 'any' }, []).total);
    const noFilters = { ...yy2023(), filters: {}, caseScope: 'all' as const };
    expect(aggregate(ds, noFilters, []).total).toBe(aggregate(ds, { ...noFilters, caseScope: 'any' }, []).total);
  });

  it('caseScope rides the URL and old links decode to any', () => {
    const enc = encodeView({ ...DEFAULT_VIEW, measure: 'cases', caseScope: 'all' });
    expect(decodeView(enc)?.caseScope).toBe('all');
    expect(decodeView(encodeView(DEFAULT_VIEW))?.caseScope).toBe('any');
  });
});

describe('dtp_review: decline-list review status (ground truth from duckdb)', () => {
  it('filings lens splits into the four review tiers exactly', () => {
    const r = aggregate(ds, view({ x: { kind: 'col', col: 'dtp_review' } }), []);
    expect(valuesByX(r.rows)).toEqual({
      'Not reviewed': 93_447,
      'Current list': 36_688,
      'Proposed, agreed (never adopted)': 28_482,
      'Proposed, disagreed': 2_517,
    });
    expect(r.total).toBe(161_134);
  });

  it('the expanded-list counterfactual: current + agreed = 65,170 filed charges', () => {
    const r = aggregate(
      ds,
      view({ filters: { dtp_review: ['Current list', 'Proposed, agreed (never adopted)'] } }),
      [],
    );
    expect(r.total).toBe(65_170);
  });

  it('quantifies the YY-tab vs review-tab delta (Bobby ruling pending)', () => {
    // dtp_class YY = 39,106; of those, 2,393 are strings the review tab
    // marks 'Proposed, disagreed' and 25 match nothing in the review tab.
    const r = aggregate(
      ds,
      view({
        x: { kind: 'col', col: 'dtp_review' },
        filters: { dtp_class: ['YY (decline list)'] },
      }),
      [],
    );
    expect(valuesByX(r.rows)).toEqual({
      'Current list': 36_688,
      'Proposed, disagreed': 2_393,
      'Not reviewed': 25,
    });
  });
});
