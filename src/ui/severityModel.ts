/**
 * Pure logic + copy for the severity filter modal. No React. Content is
 * transcribed verbatim from the 2026-08-15 severity/chapter spec; the
 * content-verification pass corrects it against sources, not this file.
 */

export const SEVERITY_COL = 'severity_class';

export const SEVERITY_VALUES = [
  'Felony',
  'Misdemeanor',
  'Civil infraction',
  'Unclassified',
] as const;

/** The explicit value carried by pre-2022 history rows, which are not
    graded for severity. */
export const SEVERITY_HISTORY_VALUE = 'Not graded (pre-2022)';

export interface SeverityLink {
  label: string;
  href: string;
  external: boolean;
}

export interface SeverityCard {
  value: string;
  blurb: string; // the one-liner under the name
  detail: { paragraphs: string[]; links?: SeverityLink[] };
}

export const SEVERITY_CARDS: SeverityCard[] = [
  {
    value: 'Felony',
    blurb: 'Crimes punishable by imprisonment in state prison.',
    detail: {
      paragraphs: [
        'A charge that pleads no repeat-offense enhancement is graded as the base offense; repeat-offense charges (2nd, 3rd, subsequent) are graded at their pleaded tier.',
      ],
    },
  },
  {
    value: 'Misdemeanor',
    blurb: 'Every other crime: anything not punishable by state prison.',
    detail: {
      paragraphs: [
        'Fine-only crimes are misdemeanors too. Unlicensed operation of a motor vehicle stays here rather than with the civil infractions because chapter 90C expressly keeps it a crime.',
      ],
    },
  },
  {
    value: 'Civil infraction',
    blurb: 'Not crimes: civil motor vehicle infractions charged alongside criminal cases.',
    detail: {
      paragraphs: [
        "Speeding, marked-lanes and similar violations are civil under G.L. c. 90C. They appear in this dataset because they were filed in criminal court, usually next to criminal charges. Nearly all carry SCDAO's own civil-infraction marker in the charge text; the rest were graded civil by statute.",
      ],
    },
  },
  {
    value: 'Unclassified',
    blurb: 'Charges the grading declined to guess.',
    detail: {
      paragraphs: [
        "Three families: offenses graded by an underlying crime the charge does not name (attempts, conspiracies, fugitive-from-justice holds, failures to appear); pre-2018 charge language whose dollar amount straddles today's felony line; and catch-all codes with no identifiable statute.",
      ],
    },
  },
  {
    value: SEVERITY_HISTORY_VALUE,
    blurb: 'The 2006-2021 dataset is not graded.',
    detail: {
      paragraphs: [
        "The crime list states current law, and the law moved: larceny's felony line rose from $250 to $1,200 in 2018, and offenses have been created since. Grading 2006-2021 charges needs the law as it stood at charging, which this project has not done. Rather than guess, these rows are labeled Not graded.",
      ],
    },
  },
];

export const SEVERITY_HEADER: { paragraphs: string[]; links: SeverityLink[] } = {
  paragraphs: [
    "Severity is graded from the Massachusetts Sentencing Commission's Felony and Misdemeanor Master Crime List (February 2026 edition), applied to each charge's statute code and charge text.",
    'The dividing line is where the sentence can be served: a crime punishable by imprisonment in state prison is a felony (G.L. c. 274 § 1); every other crime is a misdemeanor.',
  ],
  links: [
    {
      label: 'The Master Crime List (mass.gov)',
      href: 'https://www.mass.gov/doc/master-crime-list',
      external: true,
    },
    {
      label: 'G.L. c. 274 § 1',
      href: 'https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=274',
      external: true,
    },
  ],
};

export const SEVERITY_FOOTNOTE_NO_HISTORY: string =
  'The 2006-2021 dataset is not graded for severity; turn on "Include 2006-2021" to see it listed here.';

/** 'Felony' | 'Felony + Misdemeanor' | 'Felony + 2 more'. Mirrors
    chapterSummary's shape and dtpModel.summaryLabel's two-selection
    behavior: two selections join both names; three or more collapse to a
    count. */
export function severitySummary(selected: string[]): string {
  if (selected.length === 0) return 'any';
  if (selected.length === 1) return selected[0];
  if (selected.length === 2) return `${selected[0]} + ${selected[1]}`;
  return `${selected[0]} + ${selected.length - 1} more`;
}

/** Mirror MultiSelect/dtpModel.normalizeSelection: a selection covering
    every available value collapses to []. */
export function normalizeSeverity(selected: string[], available: string[]): string[] {
  const sel = new Set(selected);
  return available.every((v) => sel.has(v)) ? [] : selected;
}
