import { describe, expect, it } from 'vitest';
import {
  SEVERITY_CARDS, SEVERITY_COL, SEVERITY_VALUES, SEVERITY_HEADER,
  SEVERITY_HISTORY_VALUE, SEVERITY_FOOTNOTE_NO_HISTORY,
  severitySummary, normalizeSeverity,
} from './severityModel';

describe('SEVERITY_COL', () => {
  it('is the parquet column name', () => {
    expect(SEVERITY_COL).toBe('severity_class');
  });
});

describe('SEVERITY_CARDS', () => {
  it('has exactly the five allowed values, in order', () => {
    expect(SEVERITY_CARDS.map((c) => c.value)).toEqual([
      ...SEVERITY_VALUES,
      SEVERITY_HISTORY_VALUE,
    ]);
  });
  it('every blurb and every detail paragraph is non-empty', () => {
    for (const c of SEVERITY_CARDS) {
      expect(c.blurb.length).toBeGreaterThan(0);
      expect(c.detail.paragraphs.length).toBeGreaterThan(0);
      for (const p of c.detail.paragraphs) expect(p.length).toBeGreaterThan(0);
    }
  });
});

describe('SEVERITY_HEADER', () => {
  it('has exactly 2 paragraphs and 2 external links', () => {
    expect(SEVERITY_HEADER.paragraphs.length).toBe(2);
    expect(SEVERITY_HEADER.links.length).toBe(2);
    for (const link of SEVERITY_HEADER.links) {
      expect(link.external).toBe(true);
      expect(link.label.length).toBeGreaterThan(0);
      expect(link.href).toMatch(/^https:\/\//);
    }
  });
});

describe('SEVERITY_FOOTNOTE_NO_HISTORY', () => {
  it('is a non-empty string', () => {
    expect(SEVERITY_FOOTNOTE_NO_HISTORY.length).toBeGreaterThan(0);
  });
});

describe('severitySummary', () => {
  it('reads "any" for zero selections', () => {
    expect(severitySummary([])).toBe('any');
  });
  it('names a single selection', () => {
    expect(severitySummary(['Felony'])).toBe('Felony');
  });
  it('joins both names for two selections', () => {
    expect(severitySummary(['Felony', 'Misdemeanor'])).toBe('Felony + Misdemeanor');
  });
  it('counts past two selections', () => {
    expect(severitySummary(['Felony', 'Misdemeanor', 'Unclassified'])).toBe('Felony + 2 more');
  });
});

describe('normalizeSeverity', () => {
  const available = [...SEVERITY_VALUES];
  it('returns [] when every available value is selected', () => {
    expect(normalizeSeverity([...available], available)).toEqual([]);
  });
  it('passes through a partial selection', () => {
    expect(normalizeSeverity(['Felony'], available)).toEqual(['Felony']);
  });
});
