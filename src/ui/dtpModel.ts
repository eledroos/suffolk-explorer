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
