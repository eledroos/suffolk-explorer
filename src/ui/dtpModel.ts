/**
 * Pure logic for the decline-to-prosecute filter modal. No React.
 * Content facts are sourced from the 2019 Rollins policy memo, the SCDAO
 * classification worksheet (its YY, NY, NS, NN and YY REVIEW tabs), and the
 * assembled parquets; every number below is re-derived and recorded in
 * docs/specs/dtp-ground-truth-results.md before ship. Copy attributes claims
 * to the classification, not to the office.
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
    'would presume not to prosecute. The categories below tag every charge by ' +
    'how a 2020 office classification treats its charge type, not by what ' +
    'happened in the individual case.',
  detail: [
    'The classification comes from a worksheet created inside the District ' +
      'Attorney’s office in 2020, used here to tag every charge by its charge ' +
      'description (whitespace-normalized, with a 75-character fallback for ' +
      'descriptions truncated in the source deliveries).',
    'The review tiers come from the same worksheet’s review tab, which sorts a ' +
      'proposed expansion of the list into an agreed section and a disagreed ' +
      'section. The tab was circulated to four reviewers and carries one ' +
      'reviewer’s responses. The worksheet records no adoption of the expansion.',
  ],
};

export const DTP_CAVEAT =
  'These two groupings overlap imperfectly: some charges tagged as on the ' +
  'decline list carry descriptions the review tab rejected. The worksheet ' +
  'itself contains the conflict, and this project’s tagging preserves it. The ' +
  'decline-list tags above come from the classification’s broader YY tab; the ' +
  'operative 46-string list is the narrower set under Review status. The ' +
  'conflict is documented in the data README and a ruling on it is pending.';

export const DTP_CONTENT: Record<DtpColumn, { title: string; cards: DtpCard[] }> = {
  dtp_class: {
    title: 'The decline list',
    cards: [
      {
        value: 'YY (decline list)',
        name: 'On the decline list',
        plain: 'Charge types the classification designates decline-to-prosecute.',
        detail: [
          'The tag comes from the worksheet’s YY tab, 69 charge-description ' +
            'strings. That set is broader than the operative 46-string list ' +
            'shown under Review status, and it includes drug distribution ' +
            'charges the worksheet’s own annotations say were not in the memo. ' +
            'In this data the tag is applied by charge description, so it ' +
            'reflects the charge as recorded, not a case-level decision.',
          'The memo’s own text limits the policy to the municipal courts and ' +
            'Chelsea District Court; charges filed in Suffolk Superior Court ' +
            'carry the tag by charge type only.',
          'Caveat: 2,393 charges filed 2022 to 2025 carry this tag on ' +
            'descriptions the review tab lists as proposed-but-disagreed. The ' +
            'worksheet itself contains that conflict; a ruling is pending.',
        ],
      },
      {
        value: 'NY (presumption against)',
        name: 'Presumption against',
        plain: 'Charge types the classification marks with a presumption against prosecution.',
        detail: [
          'Classified NY in the worksheet: not on the operative list, but ' +
            'treated as carrying a presumption against prosecution. The ' +
            'worksheet defines the tag to cover charges its author judged ' +
            'should fall under the memo’s broader categories, not only charges ' +
            'the memo names.',
        ],
      },
      {
        value: 'NS (case-by-case)',
        name: 'Case-by-case',
        plain: 'Charge types the classification leaves to case-by-case judgment.',
        detail: [
          'Classified NS in the worksheet: no presumption either way. The ' +
            'worksheet’s own review disagrees with the case-by-case ' +
            'designation on rows covering about three quarters of these charges.',
        ],
      },
      {
        value: 'NN (prosecute)',
        name: 'Ordinarily prosecuted',
        plain: 'Charge types the classification expects to be prosecuted.',
        detail: [
          'Classified NN in the worksheet: not cited in the memo, and judged ' +
            'not to belong in the declination policy.',
        ],
      },
      {
        value: 'Not listed',
        name: 'Not listed',
        plain: 'Charge descriptions that match nothing in the classification.',
        detail: [
          'About 1% of the charges in the 2022 to 2025 file and about 6% of ' +
            'the charges in the pre-2022 file. Mostly truncated or rare ' +
            'description variants that failed the match even with the ' +
            '75-character fallback.',
          'The pre-2022 share runs higher because the older deliveries record ' +
            'many charges in a plainer description format, such as ' +
            '"TRESPASSING" where the worksheet carries "TRESPASS c. 266 s. 120".',
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
          'The memo lists 15 offenses; the operative list expands them to 46 ' +
            'charge descriptions. Where one description also appears in a ' +
            'rejected proposal, the operative list wins.',
        ],
      },
      {
        value: 'Proposed, agreed (never adopted)',
        name: 'Proposed and agreed, never adopted',
        plain: 'A 2020 review inside the office marked 76 further charges agreed for declination; the expansion never became policy.',
        detail: [
          'The agreed expansion covers 107 statute-variant description ' +
            'strings. 32 of the 107 are civil motor vehicle infractions, ' +
            'about a third of this tier’s charge volume in the 2022 to 2025 ' +
            'file. Filtering on this shows what the expansion would have ' +
            'covered, not anything the office committed to.',
        ],
      },
      {
        value: 'Proposed, disagreed',
        name: 'Proposed, rejected',
        plain: 'Proposed for the expansion and marked disagreed in the review.',
        detail: [
          '16 description strings, after the operative list takes precedence ' +
            'over the section’s 17 raw rows. Three of those rows record a ' +
            'deferral for consultation with the Human Trafficking Unit rather ' +
            'than a no, and one row agrees on possession with intent while ' +
            'refusing distribution.',
          'Some of these strings still carry the on-the-list tag in the other ' +
            'grouping. That is the documented inconsistency noted above.',
        ],
      },
      {
        value: 'Not reviewed',
        name: 'Not reviewed',
        plain: 'Everything the review never looked at. It is the large majority of charges.',
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
        : `${cls.length} categories`;
  const revPart =
    rev.length === 0
      ? 'any'
      : rev.length <= 2
        ? rev.join(' + ')
        : `${rev.length} selected`;
  return `${clsPart} · review: ${revPart}`;
}
