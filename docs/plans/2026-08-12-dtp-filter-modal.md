# DTP Filter Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two bare DTP MultiSelects with one "Decline-to-prosecute" sidebar entry opening a modal that explains every DTP category in layered plain language and stages the filter with live counts.

**Architecture:** Pure logic (content constant, staging, normalization, count-view derivation, summary labels) lives in a new React-free module `src/ui/dtpModel.ts`, unit-tested with the repo's existing vitest setup. A thin React modal `src/ui/DtpFilterModal.tsx` renders it on the existing `Modal` component. `FilterPanel.tsx` swaps its two DTP MultiSelects for a summary row plus Edit button and owns the modal's open state. Engine and `contract.ts` are untouched.

**Tech Stack:** React 18 + TypeScript + Vite; vitest (node env, no DOM testing libs — React shell is verified by typecheck, build, and browser passes); native `<dialog>` via existing `Modal`.

## Global Constraints

- Spec: `docs/specs/2026-08-12-dtp-filter-modal-design.md`. Read it first.
- Do NOT edit `src/contract.ts`, `src/engine/**`, `package.json`, `vite.config.ts`, `tsconfig*.json`, `scripts/`, `public/` (DESIGN.md module ownership).
- Work in the explorer repo: `/Users/nasser/_dev/nasser-blog-posts/2026-08-03 Suffolk DA/data/suffolk-explorer` (it is its own git repo; commit there).
- Exact data values (verified against both parquets 2026-08-12, identical in both):
  - `dtp_class`: `YY (decline list)`, `NY (presumption against)`, `NS (case-by-case)`, `NN (prosecute)`, `Not listed`
  - `dtp_review`: `Current list`, `Proposed, agreed (never adopted)`, `Proposed, disagreed`, `Not reviewed`
- Filter semantics must exactly mirror `MultiSelect.tsx:36`: a selection containing every value normalizes to `[]` (= no filter).
- No AI attribution anywhere in UI copy or commits beyond the standard trailer.
- Commands: `npm run test` (vitest run), `npx tsc --noEmit -p tsconfig.json` if a typecheck script is absent (check `package.json` scripts; `npm run build` runs tsc first if configured — use `npm run build` as the type gate).

---

### Task 1: dtpModel — content constant and selection logic

**Files:**
- Create: `src/ui/dtpModel.ts`
- Test: `src/ui/dtpModel.test.ts`

**Interfaces:**
- Produces (later tasks rely on these exact names):
  - `DTP_COLUMNS = ['dtp_class', 'dtp_review'] as const; type DtpColumn = typeof DTP_COLUMNS[number]`
  - `interface DtpCard { value: string; name: string; plain: string; detail: string[] }`
  - `DTP_CONTENT: Record<DtpColumn, { title: string; cards: DtpCard[] }>`
  - `DTP_HEADER: { plain: string; detail: string[] }`
  - `DTP_CAVEAT: string`
  - `cardsFor(col: DtpColumn, dataValues: string[]): DtpCard[]`
  - `normalizeSelection(selected: string[], allValues: string[]): string[]`
  - `stageFromFilters(filters: Record<string, string[]>): Record<DtpColumn, Set<string>>`
  - `applyPayload(staged: Record<DtpColumn, Set<string>>, dataValues: Record<DtpColumn, string[]>): Record<DtpColumn, string[]>`

- [ ] **Step 1: Write the failing tests**

```ts
// src/ui/dtpModel.test.ts
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
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npm run test -- src/ui/dtpModel.test.ts`
Expected: FAIL, cannot resolve `./dtpModel`.

- [ ] **Step 3: Implement `src/ui/dtpModel.ts` (content + selection half)**

```ts
/**
 * Pure logic for the decline-to-prosecute filter modal. No React.
 * Content facts are sourced from data/assembled/README.md, the SCDAO
 * classification workbook, and its YY REVIEW tab; every number below is
 * re-derived by docs/specs/dtp-ground-truth.py (Task 6/7) before ship.
 */

export const DTP_COLUMNS = ['dtp_class', 'dtp_review'] as const;
export type DtpColumn = (typeof DTP_COLUMNS)[number];

export interface DtpCard {
  value: string;    // exact data value, used as the filter payload
  name: string;     // display name
  plain: string;    // layer 1: one sentence anyone can read
  detail: string[]; // layer 2: paragraphs for the expert reader
}

export const DTP_HEADER = {
  plain:
    'In 2019 the Rollins administration published a list of charges the office ' +
    'would presume not to prosecute. These categories tag every charge in this ' +
    'data by where its charge type stands relative to that list. They describe ' +
    'the charge type, not what happened to the individual case.',
  detail: [
    'The categories come from a classification workbook built with this ' +
      'project’s collaborators and applied to each charge by its charge ' +
      'description (whitespace-normalized, with a 75-character fallback for ' +
      'descriptions truncated in the source deliveries).',
    'The review tiers come from the same workbook’s review tab, which ' +
      'records what a working group proposed to add to the list and what was ' +
      'agreed or rejected. The proposed expansion was never adopted as policy.',
  ],
};

export const DTP_CAVEAT =
  'These two groupings overlap imperfectly: some charges tagged as on the ' +
  'decline list carry descriptions the review tab rejected. The inconsistency ' +
  'is in the source classification, is documented in the data README, and a ' +
  'ruling on it is pending.';

export const DTP_CONTENT: Record<DtpColumn, { title: string; cards: DtpCard[] }> = {
  dtp_class: {
    title: 'The decline list',
    cards: [
      {
        value: 'YY (decline list)',
        name: 'On the decline list',
        plain: 'Charge types on the office’s operative decline-to-prosecute list.',
        detail: [
          'The operative list is 46 charge descriptions, operationalized from ' +
            'the 2019 policy memo’s offense categories. In this data the tag is ' +
            'applied by charge description, so it reflects the charge as ' +
            'recorded, not a case-level decision.',
          'Caveat: 2,393 charges filed 2022–2025 carry this tag on ' +
            'descriptions the review tab lists as proposed-but-disagreed. That ' +
            'conflict is in the source classification; a ruling is pending.',
        ],
      },
      {
        value: 'NY (presumption against)',
        name: 'Presumption against',
        plain: 'Charge types the office presumes against prosecuting, short of the formal list.',
        detail: [
          'Classified NY in the workbook: not on the operative list, but ' +
            'treated as carrying a presumption against prosecution.',
        ],
      },
      {
        value: 'NS (case-by-case)',
        name: 'Case-by-case',
        plain: 'Charge types the office weighs one case at a time.',
        detail: ['Classified NS in the workbook: no presumption either way.'],
      },
      {
        value: 'NN (prosecute)',
        name: 'Ordinarily prosecuted',
        plain: 'Charge types the office ordinarily prosecutes.',
        detail: ['Classified NN in the workbook.'],
      },
      {
        value: 'Not listed',
        name: 'Not listed',
        plain: 'Charge descriptions that match nothing in the classification, about 1% of charges.',
        detail: [
          'Mostly truncated or rare description variants that failed the ' +
            'match even with the 75-character fallback.',
        ],
      },
    ],
  },
  dtp_review: {
    title: 'Review status',
    cards: [
      {
        value: 'Current list',
        name: 'Current list',
        plain: 'Charge types on the operative decline list.',
        detail: [
          'The 46 charge descriptions in force. Where one description also ' +
            'appears in a rejected proposal, the operative list wins.',
        ],
      },
      {
        value: 'Proposed, agreed (never adopted)',
        name: 'Proposed and agreed, never adopted',
        plain: 'A working group agreed to expand the list by 76 charges; the expansion was never adopted as policy.',
        detail: [
          'The agreed expansion covers 107 statute-variant description ' +
            'strings. Filtering on this shows what the expansion would have ' +
            'covered, not anything the office committed to.',
        ],
      },
      {
        value: 'Proposed, disagreed',
        name: 'Proposed, rejected',
        plain: 'Proposed for the expansion; the working group said no.',
        detail: [
          '17 description strings. Some of these still carry the on-the-list ' +
            'tag in the other grouping — that is the documented ' +
            'inconsistency noted above.',
        ],
      },
      {
        value: 'Not reviewed',
        name: 'Not reviewed',
        plain: 'Everything the review never looked at — the large majority of charges.',
        detail: [
          'No proposal touched these charge types; absence from review is ' +
            'not a statement about them.',
        ],
      },
    ],
  },
};

/** Known cards in content order, plus a bare card per unknown data value. */
export function cardsFor(col: DtpColumn, dataValues: string[]): DtpCard[] {
  const known = DTP_CONTENT[col].cards;
  const knownSet = new Set(known.map((c) => c.value));
  const extras = dataValues
    .filter((v) => !knownSet.has(v))
    .sort()
    .map((value) => ({ value, name: value, plain: '', detail: [] as string[] }));
  return [...known, ...extras];
}

/** Mirror MultiSelect: a selection covering every value collapses to []. */
export function normalizeSelection(selected: string[], allValues: string[]): string[] {
  const sel = new Set(selected);
  return allValues.every((v) => sel.has(v)) ? [] : selected;
}

export function stageFromFilters(
  filters: Record<string, string[]>,
): Record<DtpColumn, Set<string>> {
  return {
    dtp_class: new Set(filters.dtp_class ?? []),
    dtp_review: new Set(filters.dtp_review ?? []),
  };
}

export function applyPayload(
  staged: Record<DtpColumn, Set<string>>,
  dataValues: Record<DtpColumn, string[]>,
): Record<DtpColumn, string[]> {
  const out = {} as Record<DtpColumn, string[]>;
  for (const col of DTP_COLUMNS) {
    const all = [
      ...new Set([...DTP_CONTENT[col].cards.map((c) => c.value), ...dataValues[col]]),
    ];
    out[col] = normalizeSelection([...staged[col]], all);
  }
  return out;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npm run test -- src/ui/dtpModel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dtpModel.ts src/ui/dtpModel.test.ts
git commit -m "DTP modal: content constant and selection logic"
```

---

### Task 2: dtpModel — count view, count extraction, cache signature, summary label

**Files:**
- Modify: `src/ui/dtpModel.ts` (append)
- Test: `src/ui/dtpModel.test.ts` (append)

**Interfaces:**
- Consumes: `ViewState`, `AggResult` types from `../contract` (types only; no engine import in this module).
- Produces:
  - `buildCountView(view: ViewState, col: DtpColumn): ViewState`
  - `countsFromAgg(agg: { rows: { x: string; value: number }[]; total: number }): { byValue: Map<string, number>; total: number }`
  - `countSignature(view: ViewState): string`
  - `summaryLabel(filters: Record<string, string[]>): string`

- [ ] **Step 1: Append failing tests**

```ts
// append to src/ui/dtpModel.test.ts
import { buildCountView, countsFromAgg, countSignature, summaryLabel } from './dtpModel';
import { DEFAULT_VIEW } from '../contract';

const baseView = {
  ...DEFAULT_VIEW,
  lens: 'filings' as const,
  filters: {
    dtp_class: ['YY (decline list)'],
    dtp_review: ['Current list'],
    court: ['BMC Central'],
    'g:abc': ['Bucket 1'],
  },
  dateFrom: '2023-01-01',
  dateTo: null,
};

describe('buildCountView', () => {
  it('strips both DTP filters, keeps every other filter, targets the column', () => {
    const cv = buildCountView(baseView, 'dtp_class');
    expect(cv.filters.dtp_class).toBeUndefined();
    expect(cv.filters.dtp_review).toBeUndefined();
    expect(cv.filters.court).toEqual(['BMC Central']);
    expect(cv.filters['g:abc']).toEqual(['Bucket 1']);
    expect(cv.x).toEqual({ kind: 'col', col: 'dtp_class' });
    expect(cv.series).toBeNull();
    expect(cv.measure).toBe('charges');
    expect(cv.pct).toBe(false);
    expect(cv.lens).toBe('filings');
    expect(cv.dateFrom).toBe('2023-01-01');
  });
  it('does not mutate the input view', () => {
    const before = JSON.stringify(baseView);
    buildCountView(baseView, 'dtp_review');
    expect(JSON.stringify(baseView)).toBe(before);
  });
});

describe('countsFromAgg', () => {
  it('maps x values to counts and carries the total', () => {
    const { byValue, total } = countsFromAgg({
      rows: [
        { x: 'YY (decline list)', value: 10 },
        { x: 'Not listed', value: 3 },
      ],
      total: 13,
    });
    expect(byValue.get('YY (decline list)')).toBe(10);
    expect(byValue.get('NN (prosecute)')).toBeUndefined();
    expect(total).toBe(13);
  });
});

describe('countSignature', () => {
  it('ignores DTP filters and chart cosmetics, tracks everything that changes counts', () => {
    const a = countSignature(baseView);
    const b = countSignature({ ...baseView, filters: { ...baseView.filters, dtp_class: [] } });
    const c = countSignature({ ...baseView, chart: 'heatmap' as const });
    const d = countSignature({ ...baseView, dateFrom: '2024-01-01' });
    const e = countSignature({ ...baseView, filters: { ...baseView.filters, court: ['Chelsea'] } });
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(d).not.toBe(a);
    expect(e).not.toBe(a);
  });
});

describe('summaryLabel', () => {
  it('reads "any" with nothing set', () => {
    expect(summaryLabel({})).toBe('any');
  });
  it('names class selections and review state', () => {
    expect(
      summaryLabel({ dtp_class: ['YY (decline list)', 'NY (presumption against)'] }),
    ).toBe('On the decline list + Presumption against · review: any');
  });
  it('shows counts past two selections', () => {
    expect(
      summaryLabel({
        dtp_class: ['YY (decline list)', 'NY (presumption against)', 'Not listed'],
        dtp_review: ['Current list'],
      }),
    ).toBe('3 of 5 categories · review: Current list');
  });
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npm run test -- src/ui/dtpModel.test.ts`

- [ ] **Step 3: Append the implementation**

```ts
// append to src/ui/dtpModel.ts
import type { ViewState } from '../contract';

/** ViewState for the modal's live counts: same world minus the DTP filters,
    aggregated by the target column. */
export function buildCountView(view: ViewState, col: DtpColumn): ViewState {
  const filters: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(view.filters)) {
    if (k === 'dtp_class' || k === 'dtp_review') continue;
    filters[k] = v;
  }
  return {
    ...view,
    x: { kind: 'col', col },
    series: null,
    measure: 'charges',
    pct: false,
    filters,
  };
}

export function countsFromAgg(agg: {
  rows: { x: string; value: number }[];
  total: number;
}): { byValue: Map<string, number>; total: number } {
  const byValue = new Map<string, number>();
  for (const r of agg.rows) byValue.set(r.x, (byValue.get(r.x) ?? 0) + r.value);
  return { byValue, total: agg.total };
}

/** Changes exactly when the modal's counts could change. */
export function countSignature(view: ViewState): string {
  const filters: Record<string, string[]> = {};
  for (const k of Object.keys(view.filters).sort()) {
    if (k === 'dtp_class' || k === 'dtp_review') continue;
    filters[k] = view.filters[k];
  }
  return JSON.stringify({
    lens: view.lens,
    dateFrom: view.dateFrom,
    dateTo: view.dateTo,
    history: view.history,
    filters,
  });
}

const SHORT_CLASS: Record<string, string> = {
  'YY (decline list)': 'On the decline list',
  'NY (presumption against)': 'Presumption against',
  'NS (case-by-case)': 'Case-by-case',
  'NN (prosecute)': 'Ordinarily prosecuted',
  'Not listed': 'Not listed',
};

export function summaryLabel(filters: Record<string, string[]>): string {
  const cls = filters.dtp_class ?? [];
  const rev = filters.dtp_review ?? [];
  if (cls.length === 0 && rev.length === 0) return 'any';
  const clsPart =
    cls.length === 0
      ? 'any category'
      : cls.length <= 2
        ? cls.map((v) => SHORT_CLASS[v] ?? v).join(' + ')
        : `${cls.length} of ${DTP_CONTENT.dtp_class.cards.length} categories`;
  const revPart =
    rev.length === 0
      ? 'any'
      : rev.length <= 2
        ? rev.join(' + ')
        : `${rev.length} of ${DTP_CONTENT.dtp_review.cards.length}`;
  return `${clsPart} · review: ${revPart}`;
}
```

Note: `DEFAULT_VIEW` must be exported from `src/contract.ts` already — verify with `grep -n "DEFAULT_VIEW" src/contract.ts` (it is; line ~112). `history` exists on ViewState.

- [ ] **Step 4: Run tests, verify pass; then full suite**

Run: `npm run test`
Expected: dtpModel tests and the existing engine suite all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dtpModel.ts src/ui/dtpModel.test.ts
git commit -m "DTP modal: count view derivation, cache signature, summary label"
```

---

### Task 3: DtpFilterModal component

**Files:**
- Create: `src/ui/DtpFilterModal.tsx`
- Modify: `src/styles.css` (append styles)

**Interfaces:**
- Consumes: `Modal` (`./Modal`, props `{title, onClose, wide?, children}`); `aggregate`, `distinctValues` from `../engine`; everything from `./dtpModel` (Task 1-2 signatures); `Dataset`, `ViewState`, `Grouping` from `../contract`; `displayValue` from `./format`.
- Produces: `export default function DtpFilterModal(props: { ds: Dataset; view: ViewState; groupings: Grouping[]; onSetFilter: (key: string, values: string[]) => void; onClose: () => void })`

- [ ] **Step 1: Implement the component**

```tsx
// src/ui/DtpFilterModal.tsx
import { useMemo, useState } from 'react';
import { aggregate, distinctValues } from '../engine';
import type { Dataset, Grouping, ViewState } from '../contract';
import {
  DTP_CAVEAT, DTP_COLUMNS, DTP_CONTENT, DTP_HEADER, type DtpColumn,
  applyPayload, buildCountView, cardsFor, countsFromAgg, stageFromFilters,
} from './dtpModel';
import Modal from './Modal';

interface Props {
  ds: Dataset;
  view: ViewState;
  groupings: Grouping[];
  onSetFilter: (key: string, values: string[]) => void;
  onClose: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US');

export default function DtpFilterModal({ ds, view, groupings, onSetFilter, onClose }: Props) {
  const [staged, setStaged] = useState(() => stageFromFilters(view.filters));

  // Counts: one aggregate per column, same world minus the DTP filters.
  // Keyed on countSignature so a view change that cannot move the counts
  // (e.g. a DTP filter applied from this modal, or a chart-type change)
  // does not recompute. aggregate() is synchronous, so there is no loading
  // state; the spec's "em-dash while computing" case cannot occur and the
  // count is always present on first paint.
  const sig = countSignature(view);
  const counts = useMemo(() => {
    const out = {} as Record<DtpColumn, { byValue: Map<string, number>; total: number }>;
    for (const col of DTP_COLUMNS)
      out[col] = countsFromAgg(aggregate(ds, buildCountView(view, col), groupings));
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds, groupings, sig]);

  const dataValues = useMemo(
    () => ({
      dtp_class: distinctValues(ds, 'dtp_class'),
      dtp_review: distinctValues(ds, 'dtp_review'),
    }),
    [ds],
  );

  const toggle = (col: DtpColumn, value: string) =>
    setStaged((s) => {
      const next = new Set(s[col]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...s, [col]: next };
    });

  const apply = () => {
    const payload = applyPayload(staged, dataValues);
    for (const col of DTP_COLUMNS) onSetFilter(col, payload[col]);
    onClose();
  };

  const clearBoth = () =>
    setStaged({ dtp_class: new Set<string>(), dtp_review: new Set<string>() });

  const bothConstrained = staged.dtp_class.size > 0 && staged.dtp_review.size > 0;

  return (
    <Modal title="Decline-to-prosecute categories" onClose={onClose} wide>
      <div className="dtp-modal">
        <p className="dtp-lede">{DTP_HEADER.plain}</p>
        <details className="dtp-more">
          <summary>More about where these categories come from</summary>
          {DTP_HEADER.detail.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </details>

        {DTP_COLUMNS.map((col, idx) => (
          <section key={col} aria-label={DTP_CONTENT[col].title}>
            <h3 className="dtp-section-title">
              {DTP_CONTENT[col].title}
              <span className="dtp-denom">
                of {fmt(counts[col].total)} charges in the current view
              </span>
            </h3>
            <ul className="dtp-cards">
              {cardsFor(col, dataValues[col]).map((card) => (
                <li key={card.value} className="dtp-card">
                  <label className="dtp-card-main">
                    <input
                      type="checkbox"
                      checked={staged[col].has(card.value)}
                      onChange={() => toggle(col, card.value)}
                    />
                    <span className="dtp-card-name">{card.name}</span>
                    <span
                      className="dtp-card-count"
                      aria-label={`${counts[col].byValue.get(card.value) ?? 0} charges`}
                    >
                      {fmt(counts[col].byValue.get(card.value) ?? 0)}
                    </span>
                  </label>
                  {card.plain && <p className="dtp-card-plain">{card.plain}</p>}
                  {card.detail.length > 0 && (
                    <details className="dtp-more">
                      <summary>More</summary>
                      {card.detail.map((p, i) => (
                        <p key={i}>{p}</p>
                      ))}
                    </details>
                  )}
                </li>
              ))}
            </ul>
            {idx === 0 && <p className="dtp-caveat">{DTP_CAVEAT}</p>}
          </section>
        ))}

        {bothConstrained && (
          <p className="dtp-footnote">
            Showing charges matching a checked decline-list category AND a
            checked review status.
          </p>
        )}

        <div className="dtp-actions">
          <button className="linklike" onClick={clearBoth}>
            Clear both
          </button>
          <span className="dtp-actions-spacer" />
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Append styles to `src/styles.css`**

Follow the file's existing custom-property and class conventions (read its
header first; reuse existing button/`linklike` styles). Add, adapted to the
file's variable names:

```css
/* Decline-to-prosecute modal */
.dtp-modal { display: flex; flex-direction: column; gap: 14px; max-width: 620px; }
.dtp-lede { margin: 0; }
.dtp-more summary { cursor: pointer; }
.dtp-section-title { display: flex; align-items: baseline; gap: 10px; margin: 6px 0 4px; }
.dtp-denom { font-size: 0.8em; opacity: 0.7; font-weight: 400; }
.dtp-cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.dtp-card { border: 1px solid var(--border, #ccc3); border-radius: 6px; padding: 8px 10px; }
.dtp-card-main { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.dtp-card-name { font-weight: 600; }
.dtp-card-count { margin-left: auto; font-variant-numeric: tabular-nums; opacity: 0.8; }
.dtp-card-plain { margin: 4px 0 0 26px; }
.dtp-card .dtp-more { margin: 2px 0 0 26px; }
.dtp-caveat { border-left: 3px solid var(--warn, #b07714); padding: 4px 10px; margin: 4px 0 0; font-size: 0.92em; }
.dtp-footnote { font-size: 0.9em; opacity: 0.85; margin: 0; }
.dtp-actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.dtp-actions-spacer { flex: 1; }
```

If `--border` / `--warn` don't exist in styles.css, substitute the file's
actual token names — do not invent new tokens.

- [ ] **Step 3: Typecheck and build**

Run: `npm run build`
Expected: clean. (No unit tests for the React shell; logic is tested in Task 1-2.)

- [ ] **Step 4: Commit**

```bash
git add src/ui/DtpFilterModal.tsx src/styles.css
git commit -m "DTP modal: component"
```

---

### Task 4: FilterPanel integration

**Files:**
- Modify: `src/ui/FilterPanel.tsx`

**Interfaces:**
- Consumes: `DtpFilterModal` (Task 3), `summaryLabel` (Task 2). FilterPanel already receives every prop the modal needs (`ds`, `view`, `groupings`, `onSetFilter`).

- [ ] **Step 1: Swap the MultiSelects for the summary entry**

In `FILTER_GROUPS` (line 11), remove `'dtp_class', 'dtp_review'` from the
Case group's `cols`.

Add imports:

```tsx
import { useState } from 'react';           // merge into the existing react import
import DtpFilterModal from './DtpFilterModal';
import { summaryLabel } from './dtpModel';
```

Inside `FilterPanel`, add state and render the entry in the Case section.
Because the Case group is rendered by the generic `grouped.map(...)` loop,
render the DTP entry immediately after the group whose label is `'Case'`:

```tsx
const [dtpOpen, setDtpOpen] = useState(false);
```

Change the `grouped.map` block to:

```tsx
{grouped.map((g) => (
  <section key={g.label} className="fp-section">
    <h4 className="microlabel fp-group-label">{g.label}</h4>
    {g.cols.map((c) => (
      <MultiSelect
        key={c.name}
        label={c.label}
        getValues={getColValues(c.name)}
        selected={view.filters[c.name] ?? []}
        onChange={(vals) => onSetFilter(c.name, vals)}
      />
    ))}
    {g.label === 'Case' && (
      <div className="ms dtp-entry">
        <button
          className="ms-head"
          onClick={() => setDtpOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="ms-label">Decline-to-prosecute</span>
          <span
            className={`ms-count${
              (view.filters.dtp_class?.length ?? 0) + (view.filters.dtp_review?.length ?? 0) > 0
                ? ' filtered'
                : ''
            }`}
          >
            {summaryLabel(view.filters)}
          </span>
        </button>
      </div>
    )}
  </section>
))}
```

At the end of the component, before `</aside>`'s sibling close, render:

```tsx
{dtpOpen && (
  <DtpFilterModal
    ds={ds}
    view={view}
    groupings={groupings}
    onSetFilter={onSetFilter}
    onClose={() => setDtpOpen(false)}
  />
)}
```

Reuse of `ms-head`/`ms-label`/`ms-count` keeps the entry visually consistent
with MultiSelect rows; the summary string may need `truncate()` (already
imported in FilterPanel) if it overflows: `truncate(summaryLabel(view.filters), 28)`.

- [ ] **Step 2: Build and manual browser pass**

Run: `npm run build && npm run dev` (or `npx vite`), open the app:
- The Case group shows "Decline-to-prosecute: any"; the two old MultiSelects
  are gone; every other filter still renders.
- Open the modal: cards, counts, disclosures render; check YY; Apply; the
  chart updates; the chip "Decline-to-prosecute list: YY (decline list)"
  appears (chips read raw values — expected); summary row shows "On the
  decline list · review: any".
- Reopen: YY staged checked. Cancel after unchecking: filter unchanged.
- Esc closes the modal and NOT the drawer (under 1100px width, the existing
  `dialog[open]` guard in FilterPanel line 57 covers this — verify).

- [ ] **Step 3: Full test suite**

Run: `npm run test`
Expected: all green (engine suite + dtpModel).

- [ ] **Step 4: Commit**

```bash
git add src/ui/FilterPanel.tsx
git commit -m "DTP modal: replace sidebar MultiSelects with summary entry"
```

---

### Task 5: Ground-truth battery (numbers gate)

**Files:**
- Create: `docs/specs/dtp-ground-truth.py`
- Create: `docs/specs/dtp-ground-truth-results.md`

**Interfaces:**
- Consumes: `public/data/hayden.parquet`, `public/data/history.parquet`; duckdb in a scratch venv (`uv venv && uv pip install duckdb`).

- [ ] **Step 1: Write the battery**

The script must print, for each scenario, per-category counts and the
denominator, in the exact shape the modal shows. Scenarios (all on
`hayden.parquet` unless said):

```python
#!/usr/bin/env python3
"""Ground truths for the DTP modal's live counts.

Each scenario mirrors buildCountView: the modal's counts are the aggregate
of the current lens + dates + every NON-DTP filter, grouped by the DTP
column. DTP filters themselves never affect the counts shown.
Compare each block against the modal opened under the same view.
"""
import duckdb

d = duckdb.connect()
H = "read_parquet('../../public/data/hayden.parquet')"

SCENARIOS = [
    ("filings lens, no filters",
     f"SELECT dtp_class, count(*) FROM {H} WHERE filed_in_window GROUP BY 1 ORDER BY 1"),
    ("filings lens, no filters, review column",
     f"SELECT dtp_review, count(*) FROM {H} WHERE filed_in_window GROUP BY 1 ORDER BY 1"),
    ("dispositions lens",
     f"SELECT dtp_class, count(*) FROM {H} WHERE disposed_in_window GROUP BY 1 ORDER BY 1"),
    ("filings + court=BMC Central",
     f"SELECT dtp_class, count(*) FROM {H} WHERE filed_in_window AND court='BMC Central' GROUP BY 1 ORDER BY 1"),
    ("filings + date range 2024-01-01..2024-12-31",
     f"SELECT dtp_class, count(*) FROM {H} WHERE filed_in_window AND filing_date BETWEEN '2024-01-01' AND '2024-12-31' GROUP BY 1 ORDER BY 1"),
    ("filings + dtp_class filter active (counts must IGNORE it)",
     f"SELECT dtp_class, count(*) FROM {H} WHERE filed_in_window GROUP BY 1 ORDER BY 1"),
    ("empty view: court filter matching nothing",
     f"SELECT dtp_class, count(*) FROM {H} WHERE filed_in_window AND court='__nope__' GROUP BY 1 ORDER BY 1"),
]

for name, q in SCENARIOS:
    print(f"=== {name} ===")
    rows = d.sql(q).fetchall()
    tot = sum(r[1] for r in rows)
    for r in rows:
        print(f"  {r[0]:<36}{r[1]:>10,}")
    print(f"  {'TOTAL':<36}{tot:>10,}")
```

Note the exact court value: run
`SELECT DISTINCT court FROM ... LIMIT 20` first and use a real court string
in the scenario and in the browser when comparing. Record which one you used.

- [ ] **Step 2: Run the battery, capture results**

Run it, paste the output into `docs/specs/dtp-ground-truth-results.md`, then
open the dev app and reproduce each scenario in the UI (set the same lens /
date / court filter, open the modal, compare every number including the
denominator). Any mismatch is a bug: STOP, fix, re-run.

Two scenarios need special care:
- "dtp_class filter active": set the YY filter in the modal, apply, reopen —
  the counts must equal the unfiltered scenario, not shrink.
- The custom-grouping scenario can't run in SQL directly: create a grouping
  over `court` in the UI bucketing two courts, filter on one bucket, and
  verify the modal totals equal the sum of a per-court SQL scenario for those
  courts. Add that SQL by hand to the results file.

- [ ] **Step 3: Record pass/fail per scenario in the results file and commit**

```bash
git add docs/specs/dtp-ground-truth.py docs/specs/dtp-ground-truth-results.md
git commit -m "DTP modal: ground-truth count battery and results"
```

---

### Task 6: Content verification (content gate)

**Files:**
- Modify: `src/ui/dtpModel.ts` (only if a fact fails verification)
- Modify: `docs/specs/dtp-ground-truth-results.md` (append a content section)

- [ ] **Step 1: Re-derive every number in DTP_CONTENT**

From the workbook and data (scratch venv, openpyxl + duckdb):

- "46 charge descriptions" on the current list → open the workbook that the
  build actually reads: `data/assembled/build_pre2022.py::load_review` names
  the file (constant `DTPWB`) and the tab (`YY REVIEW`). Count distinct
  normalized strings per section (current, agreed, disagreed) with the same
  section-header parsing `load_review` uses.
- "76 charges / 107 statute-variant strings" for the agreed expansion.
- "17 strings" disagreed.
- "2,393 charges filed 2022-2025" YY-tagged with review-disagreed strings →
  `SELECT count(*) FROM hayden.parquet WHERE filed_in_window AND dtp_class LIKE 'YY%' AND dtp_review='Proposed, disagreed'`.
- "about 1%" Not listed → recompute share on the hayden file.
- "In 2019 the Rollins administration published a list" → confirm year
  against the repo's own record (notes.md / assembled README). If the memo
  date is other than 2019, fix the copy.

- [ ] **Step 2: Fix any failing sentence in `DTP_CONTENT`, re-run tests**

Run: `npm run test`

- [ ] **Step 3: Append a "content verification" table (claim → source → verified value) to the results file and commit**

```bash
git add -A docs/specs src/ui/dtpModel.ts
git commit -m "DTP modal: content facts verified against sources"
```

---

### Task 7: Adversarial review layers (the gate Nasser asked for)

**Files:** none created; findings fixed in place.

Run FIVE independent review passes over the finished feature, each attacking
a different surface. For each, write findings into the task log; every
confirmed finding in passes 1-3 must be fixed and its fix verified before
done. Passes 4-5 findings are fixed or explicitly waived by Nasser.

- [ ] **Pass 1 — Numbers.** Fresh reviewer, no context beyond the spec:
  re-run the Task 5 battery from scratch, then invent three NEW scenarios not
  in the battery (different lens/filter/grouping combos) and check them
  against the UI. Try to construct a view where the modal's number lies.
- [ ] **Pass 2 — Content.** Fresh reviewer: take every factual sentence in
  `DTP_CONTENT`/`DTP_HEADER`/`DTP_CAVEAT` and attempt to refute it against
  the workbook, `data/assembled/README.md`, and the repo's notes. Flag any
  sentence a hostile reader could call wrong or misleading. Wording that
  implies the office endorsed the expansion, or that YY tags are case-level
  decisions, is a finding.
- [ ] **Pass 3 — State machine.** Fresh reviewer attacks staging semantics:
  open→toggle→cancel→reopen; apply→URL copy→new tab→reopen (encode/decode
  round-trip); remove a DTP chip while modal closed, reopen; check-all-apply
  equals "any" (chip-free); unknown-value normalization; rapid open/close;
  the modal open across a lens change (App re-render) — counts must follow.
- [ ] **Pass 4 — UX/accessibility.** Keyboard-only full walkthrough; VoiceOver
  labels on counts and disclosures; focus return to the Edit entry on close;
  drawer-overlay viewport (<1100px) with the modal above it, Esc layering;
  dark mode; 200% zoom; long-content scroll inside the dialog.
- [ ] **Pass 5 — Regression.** `npm run test` green; `npm run build` clean;
  grep for dead references to the removed MultiSelects; every other filter
  spot-checked; bundle size delta noted; `git diff master` read end-to-end
  for anything unrelated smuggled in.
- [ ] **Close-out:** summarize all findings and fixes in
  `docs/specs/dtp-ground-truth-results.md` under "Adversarial review", commit:

```bash
git add -A
git commit -m "DTP modal: five-angle adversarial review findings and fixes"
```

---

### Task 8: Docs

**Files:**
- Modify: `DESIGN.md` (feature list)

- [ ] **Step 1: Add the feature to DESIGN.md's feature list**

Append under Features:

```markdown
10. **DTP filter modal**: the Case group's `dtp_class`/`dtp_review`
    MultiSelects are replaced by one "Decline-to-prosecute" entry opening a
    modal (`src/ui/DtpFilterModal.tsx`, logic in `src/ui/dtpModel.ts`) with
    layered explanations per category, live counts via `aggregate()` minus
    the DTP filters, staged Apply/Cancel, MultiSelect-identical
    normalization. Spec: `docs/specs/2026-08-12-dtp-filter-modal-design.md`.
```

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "DESIGN.md: document the DTP filter modal"
```
