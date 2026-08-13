import { describe, expect, it } from 'vitest';
import {
  DTP_CONTENT, DTP_COLUMNS, cardsFor, normalizeSelection,
  stageFromFilters, applyPayload,
} from './dtpModel';

const CLASS_VALUES = [
  'YY (decline list)', 'NY (presumption against)', 'NS (case-by-case)',
  'NN (prosecute)', 'Not listed',
];
const REVIEW_VALUES = [
  'Current list', 'Proposed, agreed (never adopted)',
  'Proposed, disagreed', 'Not reviewed',
];

describe('DTP_CONTENT', () => {
  it('covers every known data value exactly once per column', () => {
    expect(DTP_CONTENT.dtp_class.cards.map((c) => c.value).sort())
      .toEqual([...CLASS_VALUES].sort());
    expect(DTP_CONTENT.dtp_review.cards.map((c) => c.value).sort())
      .toEqual([...REVIEW_VALUES].sort());
  });
  it('every card has non-empty plain text and at least one detail paragraph', () => {
    for (const col of DTP_COLUMNS)
      for (const c of DTP_CONTENT[col].cards) {
        expect(c.plain.length).toBeGreaterThan(20);
        expect(c.detail.length).toBeGreaterThan(0);
      }
  });
});

describe('cardsFor', () => {
  it('returns known cards in content order when data matches', () => {
    expect(cardsFor('dtp_class', CLASS_VALUES).map((c) => c.value))
      .toEqual(DTP_CONTENT.dtp_class.cards.map((c) => c.value));
  });
  it('appends a bare card for a data value missing from content', () => {
    const cards = cardsFor('dtp_class', [...CLASS_VALUES, 'ZZ (surprise)']);
    const bare = cards[cards.length - 1];
    expect(bare.value).toBe('ZZ (surprise)');
    expect(bare.plain).toBe('');           // bare card: no prose
    expect(cards).toHaveLength(6);
  });
  it('keeps a known card even when the data lacks its value (count will be 0)', () => {
    const cards = cardsFor('dtp_review', ['Current list', 'Not reviewed']);
    expect(cards.map((c) => c.value))
      .toEqual(DTP_CONTENT.dtp_review.cards.map((c) => c.value));
  });
});

describe('normalizeSelection', () => {
  it('full selection normalizes to [] like MultiSelect', () => {
    expect(normalizeSelection([...CLASS_VALUES], CLASS_VALUES)).toEqual([]);
  });
  it('partial selection passes through', () => {
    expect(normalizeSelection(['Not listed'], CLASS_VALUES)).toEqual(['Not listed']);
  });
  it('normalizes against the union with unknown data values', () => {
    // all 5 known checked but data also has a 6th -> NOT a full selection
    const all = [...CLASS_VALUES, 'ZZ (surprise)'];
    expect(normalizeSelection([...CLASS_VALUES], all)).toEqual([...CLASS_VALUES]);
  });
});

describe('stageFromFilters / applyPayload round-trip', () => {
  it('stages existing filters and returns them unchanged on apply', () => {
    const staged = stageFromFilters({ dtp_class: ['YY (decline list)'], other: ['x'] });
    expect([...staged.dtp_class]).toEqual(['YY (decline list)']);
    expect([...staged.dtp_review]).toEqual([]);
    const out = applyPayload(staged, { dtp_class: CLASS_VALUES, dtp_review: REVIEW_VALUES });
    expect(out.dtp_class).toEqual(['YY (decline list)']);
    expect(out.dtp_review).toEqual([]);      // empty = no filter
  });
  it('apply normalizes a full section to []', () => {
    const staged = stageFromFilters({});
    for (const v of REVIEW_VALUES) staged.dtp_review.add(v);
    const out = applyPayload(staged, { dtp_class: CLASS_VALUES, dtp_review: REVIEW_VALUES });
    expect(out.dtp_review).toEqual([]);
  });
});
