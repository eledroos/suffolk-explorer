/**
 * The coverage registry: one declarative list of known data limitations.
 * Banners (noticesFor), in-chart bands (bandsFor), heatmap column markers,
 * and CSV comments all derive from these entries, so a caveat can never
 * appear on one surface and be missing from another.
 *
 * Verified provenance for every entry lives in the source project's
 * _PRR-FILE-METADATA.md. Update or delete entries when SCDAO answers the
 * pending records requests (sent 2026-08-04).
 */
import type { Dim, Granularity, Grouping, Lens, Notice, ViewState } from '../contract';

export type BandSeverity = 'gap' | 'floor' | 'haze';

export interface CoverageEntry {
  id: string;
  /** Lenses the entry applies to. */
  lenses: Lens[];
  /** Short label for chips and band tooltips. */
  short: string;
  /** Full sentence for banners, tooltips, CSV comments. */
  detail: string;
  level: 'warn' | 'info';
  /** Show as a dismissable banner above the chart. */
  banner: boolean;
  /** Months affected (inclusive), 'YYYY-MM'. Absent = banner-only entry. */
  band?: { from: string; to: string; severity: BandSeverity };
  /** Extra activation condition beyond lens + date range. */
  when?: (view: ViewState, groupings: Grouping[]) => boolean;
}

export interface ActiveBand {
  id: string;
  short: string;
  detail: string;
  level: 'warn' | 'info';
  banner: boolean; // entry also renders as a banner (CSV avoids repeating the detail)
  severity: BandSeverity;
  from: string; // 'YYYY-MM'
  to: string;
}

const DISPOSITION_COLS = new Set([
  'disposition_date',
  'disposition_code',
  'disposition_description',
  'disposition_reason',
  'disposition_source',
  'disposed_under',
  'disposed_in_window',
]);

function dimInvolvesDisposition(dim: Dim | null, groupings: Grouping[]): boolean {
  if (!dim) return false;
  if (dim.kind === 'col') return DISPOSITION_COLS.has(dim.col);
  const g = groupings.find((x) => x.id === dim.groupingId);
  return g ? DISPOSITION_COLS.has(g.column) : false;
}

function courtInView(view: ViewState, court: string): boolean {
  const f = view.filters?.['court'] ?? [];
  return f.length === 0 || f.includes(court);
}

/** Does the view's date range intersect [startIso, endIso]? Null bound = open. */
export function rangeTouches(view: ViewState, startIso: string, endIso: string): boolean {
  const { dateFrom, dateTo } = view;
  if (dateTo !== null && dateTo < startIso) return false;
  if (dateFrom !== null && dateFrom > endIso) return false;
  return true;
}

export const COVERAGE: CoverageEntry[] = [
  {
    // NOTE: the banner range is deliberately capped at the band's end
    // (Dec 2025) rather than the original open-ended 'Oct 2024 onward'.
    // The dataset holds no dispositions after Dec 2025, so the only views
    // the cap changes are empty ones; a banner over an empty chart is noise.
    // Pinned by a regression test in engine.test.ts.
    id: 'superior-gap',
    lenses: ['dispositions'],
    short: 'Superior Court missing',
    detail:
      'Suffolk Superior dispositions are missing from Oct 2024 through Dec 2025 (~2,000 charges; records request pending). Totals for that period undercount the felony docket.',
    level: 'warn',
    banner: true,
    band: { from: '2024-10', to: '2025-12', severity: 'gap' },
    when: (view) => courtInView(view, 'Suffolk Superior Court'),
  },
  {
    id: 'sealing-2025',
    lenses: ['filings'],
    short: '2025 runs ~2-3% low',
    detail: '2025 filings run ~2-3% low: sealed cases were removed before the Mar 2026 extract.',
    level: 'info',
    banner: true,
    band: { from: '2025-01', to: '2025-12', severity: 'haze' },
  },
  {
    id: 'late-entry-floor',
    lenses: ['dispositions'],
    short: 'Counts are floors',
    detail:
      'Jul-Sep 2024 disposition counts are floors: a later pull recorded up to 4.5% more as late entries arrived.',
    level: 'info',
    banner: false, // band + chip only; not urgent enough for a banner
    band: { from: '2024-07', to: '2024-09', severity: 'floor' },
  },
  {
    id: 'disp-2021-snapshot',
    lenses: ['dispositions'],
    short: '2021 is single-source',
    detail:
      '2021 dispositions come from a single Jan 2022 DAMION snapshot, the only source on hand until SCDAO answers the pending records request; counts are floors and cannot be cross-checked.',
    level: 'info',
    banner: true,
    band: { from: '2021-01', to: '2021-12', severity: 'floor' },
    when: (view) => view.history === true,
  },
  {
    id: 'both-lens-split-rows',
    lenses: ['all'],
    short: 'Both lens counts rows, not charges',
    detail:
      'With history on, a charge filed in one source era and resolved in another appears as two rows (about 4% of the Both view). Use the Filings or Dispositions lens for counts; Both is for browsing.',
    level: 'info',
    banner: true,
    when: (view) => view.history === true,
  },
  // 'distinct-across-seam' retired 2026-08-05: the pre-2022 composite now
  // carries real DAMION IDs (same ID space as the PRR files, verified), so
  // distinct cases and people dedupe correctly across the 2021/2022 seam.
  {
    id: 'right-censor',
    lenses: ['filings'],
    short: 'Outcomes are right-censored',
    detail:
      'Outcome shares for 2024-2025 filing cohorts are right-censored: 46,575 charges were still open at extraction.',
    level: 'warn',
    banner: true,
    when: (view, groupings) => dimInvolvesDisposition(view.series, groupings),
  },
  {
    id: 'window-open',
    lenses: ['dispositions'],
    short: 'Window opens Jan 3, 2022',
    detail: 'Window opens Jan 3, 2022; Jan 1-2 had no filings (weekend).',
    level: 'info',
    banner: true,
    band: undefined,
    // With history on, the window opens in 2006, so this note would mislead.
    when: (view) => !view.history && rangeTouches(view, '2022-01-01', '2022-01-31'),
  },
  {
    // Banner-only (no band): this is not a date-range coverage gap, it is a
    // consequence of combining the Severity filter with the history toggle.
    // 'Not graded (pre-2022)' is severityModel.SEVERITY_HISTORY_VALUE; the
    // literal is duplicated here rather than imported, same as courtInView's
    // 'Suffolk Superior Court' above (engine/** does not import from ui/**,
    // see DESIGN.md's module ownership).
    id: 'severity-excludes-history',
    lenses: ['filings', 'dispositions', 'all'],
    short: 'Severity filter excludes 2006-2021',
    detail:
      'The pre-2022 dataset is not graded for severity, so an active severity filter excludes all of it. Select "Not graded (pre-2022)" in the Severity filter to include those charges.',
    level: 'info',
    banner: true,
    when: (view) => {
      const sel = view.filters['severity_class'] ?? [];
      return view.history === true && sel.length > 0 && !sel.includes('Not graded (pre-2022)');
    },
  },
];

function entryActive(e: CoverageEntry, view: ViewState, groupings: Grouping[]): boolean {
  if (!e.lenses.includes(view.lens)) return false;
  if (e.band && !rangeTouches(view, `${e.band.from}-01`, `${e.band.to}-31`)) return false;
  if (e.when && !e.when(view, groupings)) return false;
  return true;
}

/** Banner notices for the view. Wording is byte-identical to the registry. */
export function noticesFromRegistry(view: ViewState, groupings: Grouping[]): Notice[] {
  const out: Notice[] = [];
  for (const e of COVERAGE) {
    if (!e.banner) continue;
    if (!entryActive(e, view, groupings)) continue;
    out.push({ level: e.level, title: bannerTitle(e), detail: e.detail });
  }
  return out;
}

/** Banner titles preserved from the original notices implementation. */
function bannerTitle(e: CoverageEntry): string {
  switch (e.id) {
    case 'superior-gap':
      return 'Superior Court dispositions missing';
    case 'sealing-2025':
      return '2025 filings run low';
    case 'right-censor':
      return 'Outcomes are right-censored';
    case 'window-open':
      return 'Window opens Jan 3, 2022';
    default:
      return e.short;
  }
}

/** Active in-chart bands for the view (entries that carry a date range). */
export function bandsFor(view: ViewState, groupings: Grouping[]): ActiveBand[] {
  const out: ActiveBand[] = [];
  for (const e of COVERAGE) {
    if (!e.band) continue;
    if (!entryActive(e, view, groupings)) continue;
    out.push({
      id: e.id,
      short: e.short,
      detail: e.detail,
      level: e.level,
      banner: e.banner,
      severity: e.band.severity,
      from: e.band.from,
      to: e.band.to,
    });
  }
  return out;
}

// ---------------------------------------------------------------- snapping

export interface BandBuckets {
  start: string; // first bucket label at this granularity
  end: string; // last bucket label
  startPartial: boolean; // band begins mid-bucket
  endPartial: boolean; // band ends mid-bucket
}

/**
 * Snap a band's month range to bucket labels for the given granularity,
 * flagging edge buckets the band only partially covers. Labels use the same
 * formats the aggregator emits: 'YYYY-MM', 'YYYY-Qn', 'YYYY'.
 */
export function bandBuckets(band: { from: string; to: string }, gran: Granularity): BandBuckets {
  const [fy, fm] = band.from.split('-').map(Number);
  const [ty, tm] = band.to.split('-').map(Number);
  if (gran === 'month') {
    return { start: band.from, end: band.to, startPartial: false, endPartial: false };
  }
  if (gran === 'quarter') {
    const fq = Math.floor((fm - 1) / 3) + 1;
    const tq = Math.floor((tm - 1) / 3) + 1;
    return {
      start: `${fy}-Q${fq}`,
      end: `${ty}-Q${tq}`,
      startPartial: (fm - 1) % 3 !== 0,
      endPartial: tm % 3 !== 0,
    };
  }
  return {
    start: String(fy),
    end: String(ty),
    startPartial: fm !== 1,
    endPartial: tm !== 12,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM' -> 'Oct 2024' for chips and tooltips. */
export function fmtMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS[(mo || 1) - 1]} ${y}`;
}
