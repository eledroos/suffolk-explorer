import { describe, expect, it } from 'vitest';
import { CHAPTER_COL } from './chapterModel';
import { DEDICATED_MODAL_COLS, isDedicatedModalCol, singleColEntryActive } from './filterEntries';
import { SEVERITY_COL } from './severityModel';

describe('DEDICATED_MODAL_COLS', () => {
  it('has exactly the four dedicated-modal columns', () => {
    expect([...DEDICATED_MODAL_COLS].sort()).toEqual(
      ['dtp_class', 'dtp_review', SEVERITY_COL, CHAPTER_COL].sort(),
    );
  });
});

describe('isDedicatedModalCol', () => {
  it('excludes dtp_class and dtp_review, the pre-existing entry', () => {
    expect(isDedicatedModalCol('dtp_class')).toBe(true);
    expect(isDedicatedModalCol('dtp_review')).toBe(true);
  });
  it('excludes severity_class and statute_chapter, the new entries', () => {
    expect(isDedicatedModalCol(SEVERITY_COL)).toBe(true);
    expect(isDedicatedModalCol(CHAPTER_COL)).toBe(true);
  });
  it('passes through every other filterable column', () => {
    expect(isDedicatedModalCol('court')).toBe(false);
    expect(isDedicatedModalCol('race')).toBe(false);
    expect(isDedicatedModalCol('crime_type')).toBe(false);
  });
});

describe('singleColEntryActive', () => {
  it('is false when the column is absent from filters', () => {
    expect(singleColEntryActive({}, SEVERITY_COL)).toBe(false);
  });
  it('is false when the column is present but empty', () => {
    expect(singleColEntryActive({ [SEVERITY_COL]: [] }, SEVERITY_COL)).toBe(false);
  });
  it('is true when the column carries at least one selected value', () => {
    expect(singleColEntryActive({ [SEVERITY_COL]: ['Felony'] }, SEVERITY_COL)).toBe(true);
  });
  it('checks only the named column, ignoring others', () => {
    const filters = { [CHAPTER_COL]: ['c. 265'] };
    expect(singleColEntryActive(filters, SEVERITY_COL)).toBe(false);
    expect(singleColEntryActive(filters, CHAPTER_COL)).toBe(true);
  });
});
