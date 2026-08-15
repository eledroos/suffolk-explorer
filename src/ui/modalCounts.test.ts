import { describe, expect, it } from 'vitest';
import { buildCountViewFor, countSignatureFor } from './modalCounts';
import { DEFAULT_VIEW, type Grouping } from '../contract';

const baseView = {
  ...DEFAULT_VIEW,
  lens: 'filings' as const,
  filters: {
    severity_class: ['Felony'],
    court: ['BMC Central'],
    'g:abc': ['Bucket 1'],
  },
  dateFrom: '2023-01-01',
  dateTo: null,
};

describe('buildCountViewFor', () => {
  it('strips exactly its own columns from filters, keeps others', () => {
    const cv = buildCountViewFor(['severity_class'], baseView);
    expect(cv.filters.severity_class).toBeUndefined();
    expect(cv.filters.court).toEqual(['BMC Central']);
    expect(cv.filters['g:abc']).toEqual(['Bucket 1']);
  });
  it('forces measure to charges', () => {
    const withOtherMeasure = { ...baseView, measure: 'people' as const };
    const cv = buildCountViewFor(['severity_class'], withOtherMeasure);
    expect(cv.measure).toBe('charges');
  });
  it('targets the first own column as x and clears series/pct', () => {
    const cv = buildCountViewFor(['severity_class'], baseView);
    expect(cv.x).toEqual({ kind: 'col', col: 'severity_class' });
    expect(cv.series).toBeNull();
    expect(cv.pct).toBe(false);
  });
  it('strips every listed column, not just the first', () => {
    const view = {
      ...baseView,
      filters: { ...baseView.filters, statute_chapter: ['c. 265'] },
    };
    const cv = buildCountViewFor(['severity_class', 'statute_chapter'], view);
    expect(cv.filters.severity_class).toBeUndefined();
    expect(cv.filters.statute_chapter).toBeUndefined();
    expect(cv.filters.court).toEqual(['BMC Central']);
  });
  it('does not mutate the input view', () => {
    const before = JSON.stringify(baseView);
    buildCountViewFor(['severity_class'], baseView);
    expect(JSON.stringify(baseView)).toBe(before);
  });
});

describe('countSignatureFor', () => {
  const groupings: Grouping[] = [];

  it('does not change when only the own-column staging changes', () => {
    const a = countSignatureFor(['severity_class'], baseView, groupings);
    const b = countSignatureFor(
      ['severity_class'],
      { ...baseView, filters: { ...baseView.filters, severity_class: [] } },
      groupings,
    );
    expect(b).toBe(a);
  });
  it('changes when an unrelated filter changes', () => {
    const a = countSignatureFor(['severity_class'], baseView, groupings);
    const b = countSignatureFor(
      ['severity_class'],
      { ...baseView, filters: { ...baseView.filters, court: ['Chelsea'] } },
      groupings,
    );
    expect(b).not.toBe(a);
  });
  it('ignores chart cosmetics but tracks lens, dates and history', () => {
    const a = countSignatureFor(['severity_class'], baseView, groupings);
    const cosmetic = countSignatureFor(
      ['severity_class'],
      { ...baseView, chart: 'heatmap' as const },
      groupings,
    );
    const dated = countSignatureFor(
      ['severity_class'],
      { ...baseView, dateFrom: '2024-01-01' },
      groupings,
    );
    const historied = countSignatureFor(
      ['severity_class'],
      { ...baseView, history: true },
      groupings,
    );
    expect(cosmetic).toBe(a);
    expect(dated).not.toBe(a);
    expect(historied).not.toBe(a);
  });
  it('changes when groupings change', () => {
    const g2: Grouping[] = [
      { id: 'g_1', name: 'Test', column: 'court', buckets: [], otherLabel: 'Other' },
    ];
    const a = countSignatureFor(['severity_class'], baseView, groupings);
    const b = countSignatureFor(['severity_class'], baseView, g2);
    expect(b).not.toBe(a);
  });
});
