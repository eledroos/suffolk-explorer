import { describe, expect, it } from 'vitest';
import {
  CHAPTER_COL, CHAPTER_TITLES, NO_CODE_VALUE, CHAPTER_PROVENANCE,
  chapterHref, chapterTitle, chapterSummary, filterChapters,
} from './chapterModel';

describe('CHAPTER_COL', () => {
  it('is the parquet column name', () => {
    expect(CHAPTER_COL).toBe('statute_chapter');
  });
});

describe('chapterHref', () => {
  it('is null for NO_CODE_VALUE', () => {
    expect(chapterHref(NO_CODE_VALUE)).toBeNull();
  });
  it('builds the correct malegislature.gov URL for c. 94C', () => {
    expect(chapterHref('c. 94C')).toBe(
      'https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=94C',
    );
  });
});

describe('chapterTitle', () => {
  it('is null for c. 258 (SCDAO truncates 258E)', () => {
    expect(chapterTitle('c. 258')).toBeNull();
  });
  it('is null for c. 279C (SCDAO miscodes 279)', () => {
    expect(chapterTitle('c. 279C')).toBeNull();
  });
  it('is present for c. 265', () => {
    expect(chapterTitle('c. 265')).toBe('Crimes Against the Person');
  });
});

describe('CHAPTER_TITLES', () => {
  it('has no empty title value, and deliberately omits 258 and 279C', () => {
    for (const [token, title] of Object.entries(CHAPTER_TITLES)) {
      expect(title.length).toBeGreaterThan(0);
      expect(token.length).toBeGreaterThan(0);
    }
    expect(CHAPTER_TITLES['258']).toBeUndefined();
    expect(CHAPTER_TITLES['279C']).toBeUndefined();
  });
});

describe('CHAPTER_PROVENANCE', () => {
  it('is a non-empty string', () => {
    expect(CHAPTER_PROVENANCE.length).toBeGreaterThan(0);
  });
});

const rows = [
  { value: 'c. 265', count: 100 },
  { value: 'c. 267', count: 20 },
  { value: 'c. 94C', count: 50 },
  { value: NO_CODE_VALUE, count: 5 },
];

describe('filterChapters', () => {
  it('matches case-insensitively on the value token', () => {
    expect(filterChapters(rows, '94c').map((r) => r.value)).toEqual(['c. 94C']);
  });
  it('matches by a word in the title', () => {
    expect(filterChapters(rows, 'Currency').map((r) => r.value)).toEqual(['c. 267']);
  });
  it('empty query returns rows unchanged', () => {
    expect(filterChapters(rows, '')).toEqual(rows);
  });
});

describe('chapterSummary', () => {
  it('reads "any" for zero selections', () => {
    expect(chapterSummary([])).toBe('any');
  });
  it('names a single selection', () => {
    expect(chapterSummary(['c. 265'])).toBe('c. 265');
  });
  it('counts past a single selection like severitySummary', () => {
    expect(chapterSummary(['c. 265', 'c. 267', 'c. 94C'])).toBe('c. 265 + 2 more');
  });
});
