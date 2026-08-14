import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BROWSE_CHIPS, filterRows, reviewChipLabel, type DtpListRow, type DtpListsData } from './dtpBrowse';

// tsconfig.json has no resolveJsonModule (deliberately not added for this
// task, per CLAUDE.md's rule against editing tsconfig for a single test), so
// the committed JSON is read with fs rather than imported.
const JSON_PATH = fileURLToPath(new URL('../../public/data/dtp-lists.json', import.meta.url));
const DATA = JSON.parse(readFileSync(JSON_PATH, 'utf-8')) as DtpListsData;

const ROWS: DtpListRow[] = [
  { description: 'DRUG, POSSESS CLASS A c94C s34', dtp_class: 'YY (decline list)', dtp_review: 'Current list', conflict: false, n_2022_2025: 10, n_2006_2021: 20 },
  { description: 'SPEEDING c90 s17', dtp_class: 'NY (presumption against)', dtp_review: 'Proposed, agreed (never adopted)', conflict: false, n_2022_2025: 5, n_2006_2021: 0 },
  { description: 'TRESPASS c266 s120', dtp_class: 'NS (case-by-case)', dtp_review: null, conflict: false, n_2022_2025: 0, n_2006_2021: 3 },
  { description: 'A&B c265 s13A', dtp_class: 'NN (prosecute)', dtp_review: null, conflict: false, n_2022_2025: 7, n_2006_2021: 9 },
  { description: 'COCAINE, DISTRIBUTE c94C s32A', dtp_class: 'YY (decline list)', dtp_review: 'Proposed, disagreed', conflict: true, n_2022_2025: 171, n_2006_2021: 539 },
];

describe('filterRows', () => {
  it('search is a case-insensitive substring match on description', () => {
    expect(filterRows(ROWS, 'speeding', 'all').map((r) => r.description)).toEqual(['SPEEDING c90 s17']);
    expect(filterRows(ROWS, 'SpEeD', 'all').map((r) => r.description)).toEqual(['SPEEDING c90 s17']);
    expect(filterRows(ROWS, 'nomatch', 'all')).toEqual([]);
  });
  it('empty search matches everything (subject to the chip)', () => {
    expect(filterRows(ROWS, '', 'all')).toHaveLength(ROWS.length);
    expect(filterRows(ROWS, '   ', 'all')).toHaveLength(ROWS.length); // whitespace-only trims to empty
  });

  it('"all" chip applies no class filter', () => {
    expect(filterRows(ROWS, '', 'all')).toEqual(ROWS);
  });
  it('each class chip returns exactly rows of that class', () => {
    expect(filterRows(ROWS, '', 'YY (decline list)').map((r) => r.description))
      .toEqual(['DRUG, POSSESS CLASS A c94C s34', 'COCAINE, DISTRIBUTE c94C s32A']);
    expect(filterRows(ROWS, '', 'NY (presumption against)').map((r) => r.description))
      .toEqual(['SPEEDING c90 s17']);
    expect(filterRows(ROWS, '', 'NS (case-by-case)').map((r) => r.description))
      .toEqual(['TRESPASS c266 s120']);
    expect(filterRows(ROWS, '', 'NN (prosecute)').map((r) => r.description))
      .toEqual(['A&B c265 s13A']);
  });
  it('"conflicts" chip returns exactly the rows with conflict: true', () => {
    const expected = ROWS.filter((r) => r.conflict);
    expect(filterRows(ROWS, '', 'conflicts')).toEqual(expected);
  });
  it('search and chip combine (AND, not OR)', () => {
    expect(filterRows(ROWS, 'cocaine', 'conflicts').map((r) => r.description)).toEqual(['COCAINE, DISTRIBUTE c94C s32A']);
    expect(filterRows(ROWS, 'speeding', 'conflicts')).toEqual([]);
  });
  it('preserves input order; never resorts', () => {
    const reversed = [...ROWS].reverse();
    // filterRows on the reversed array should yield the reversed array's own
    // relative order, not the original ROWS order or any resort.
    expect(filterRows(reversed, '', 'all')).toEqual(reversed);
    const filteredReversed = filterRows(reversed, '', 'YY (decline list)');
    const idxA = reversed.findIndex((r) => r.description === 'COCAINE, DISTRIBUTE c94C s32A');
    const idxB = reversed.findIndex((r) => r.description === 'DRUG, POSSESS CLASS A c94C s34');
    expect(filteredReversed.map((r) => r.description)).toEqual(
      idxA < idxB
        ? ['COCAINE, DISTRIBUTE c94C s32A', 'DRUG, POSSESS CLASS A c94C s34']
        : ['DRUG, POSSESS CLASS A c94C s34', 'COCAINE, DISTRIBUTE c94C s32A'],
    );
  });
});

describe('reviewChipLabel', () => {
  it('maps the three review-tier data values to their short chip labels', () => {
    expect(reviewChipLabel('Current list')).toBe('Current');
    expect(reviewChipLabel('Proposed, agreed (never adopted)')).toBe('Agreed, never adopted');
    expect(reviewChipLabel('Proposed, disagreed')).toBe('Rejected');
  });
  it('renders null (not reviewed) as blank', () => {
    expect(reviewChipLabel(null)).toBe('');
  });
});

describe('BROWSE_CHIPS', () => {
  it('is All, the four classes, then Conflicts, with the label the spec names', () => {
    expect(BROWSE_CHIPS.map((c) => c.label)).toEqual([
      'All', 'On the decline list', 'Presumption against', 'Case-by-case', 'Ordinarily prosecuted', 'Conflicts',
    ]);
  });
});

describe('committed public/data/dtp-lists.json', () => {
  const KNOWN_CLASSES = new Set([
    'YY (decline list)', 'NY (presumption against)', 'NS (case-by-case)', 'NN (prosecute)',
  ]);
  const KNOWN_REVIEWS = new Set([
    'Current list', 'Proposed, agreed (never adopted)', 'Proposed, disagreed',
  ]);

  it('has the top-level shape the schema promises', () => {
    expect(typeof DATA.generated).toBe('string');
    expect(DATA.generated.length).toBeGreaterThan(0);
    expect(typeof DATA.source_note).toBe('string');
    expect(DATA.source_note.length).toBeGreaterThan(0);
    expect(Array.isArray(DATA.rows)).toBe(true);
    expect(DATA.rows.length).toBeGreaterThan(0);
  });

  it('every row matches the schema: field types and known enum values', () => {
    for (const r of DATA.rows) {
      expect(typeof r.description).toBe('string');
      expect(r.description.length).toBeGreaterThan(0);
      expect(KNOWN_CLASSES.has(r.dtp_class)).toBe(true);
      expect(r.dtp_review === null || KNOWN_REVIEWS.has(r.dtp_review)).toBe(true);
      expect(typeof r.conflict).toBe('boolean');
      expect(Number.isInteger(r.n_2022_2025)).toBe(true);
      expect(r.n_2022_2025).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(r.n_2006_2021)).toBe(true);
      expect(r.n_2006_2021).toBeGreaterThanOrEqual(0);
    }
  });

  it('the three review-tier string counts are 46 current / 107 agreed / 16 disagreed', () => {
    const counts: Record<string, number> = {};
    for (const r of DATA.rows) {
      if (r.dtp_review) counts[r.dtp_review] = (counts[r.dtp_review] ?? 0) + 1;
    }
    expect(counts['Current list']).toBe(46);
    expect(counts['Proposed, agreed (never adopted)']).toBe(107);
    expect(counts['Proposed, disagreed']).toBe(16);
  });

  it('every conflict row is class YY with review tier Rejected, and vice versa', () => {
    const conflictRows = DATA.rows.filter((r) => r.conflict);
    expect(conflictRows.length).toBeGreaterThan(0); // sanity: the fixture is not vacuously true
    for (const r of conflictRows) {
      expect(r.dtp_class).toBe('YY (decline list)');
      expect(r.dtp_review).toBe('Proposed, disagreed');
    }
    // Converse: every YY + Rejected row is flagged conflict (the definition
    // is an iff, per task-1-brief.md's schema note).
    const shouldBeConflict = DATA.rows.filter(
      (r) => r.dtp_class === 'YY (decline list)' && r.dtp_review === 'Proposed, disagreed',
    );
    expect(shouldBeConflict.every((r) => r.conflict)).toBe(true);
    expect(shouldBeConflict.length).toBe(conflictRows.length);
  });

  it('rows are sorted by class order (YY, NY, NS, NN) then description A-Z within class', () => {
    // The generator's sort key is `description.upper()` (scripts/prepare_dtp_lists.py
    // line 315: `(CLASS_RANK[...], r['description'].upper())`), not the raw
    // mixed-case string: several description pairs share a prefix and then
    // diverge on a lowercase-vs-uppercase letter (e.g. "...WANTON c266 §127"
    // vs "...WANTON OR MALICIOUS c. 266 s. 127"), where naive codepoint
    // comparison on the raw string disagrees with the case-insensitive sort
    // that actually produced the file. Compare upper-cased here to match.
    const classOrder = ['YY (decline list)', 'NY (presumption against)', 'NS (case-by-case)', 'NN (prosecute)'];
    let lastClassIdx = -1;
    let lastDesc = '';
    for (const r of DATA.rows) {
      const idx = classOrder.indexOf(r.dtp_class);
      const upper = r.description.toUpperCase();
      if (idx !== lastClassIdx) {
        expect(idx).toBeGreaterThan(lastClassIdx);
        lastClassIdx = idx;
        lastDesc = '';
      } else {
        expect(upper >= lastDesc).toBe(true);
      }
      lastDesc = upper;
    }
  });

  it('filterRows on the real data: Conflicts chip returns exactly the conflict-tagged rows', () => {
    const viaChip = filterRows(DATA.rows, '', 'conflicts');
    const viaFilter = DATA.rows.filter((r) => r.conflict);
    expect(viaChip).toEqual(viaFilter); // count intentionally not hardcoded; derived from the data both ways
  });
});
