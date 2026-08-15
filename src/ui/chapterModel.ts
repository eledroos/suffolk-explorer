/**
 * Pure logic + copy for the statute-chapter filter modal. No React. Chapter
 * titles are transcribed verbatim from the 2026-08-15 severity/chapter spec;
 * every entry is subject to the content-verification pass, which removes
 * anything it cannot verify. c. 258, c. 279C and c. 269C are deliberately
 * absent and unlinked (see MISCODED_TOKENS): SCDAO truncates 258E to 258
 * and miscodes 279 as 279C and 269 as 269C, so a real chapter
 * title there would mislead.
 */

export const CHAPTER_COL = 'statute_chapter';

export const NO_CODE_VALUE = 'No statute code';

/** token (e.g. '265', '94C') -> official chapter title. Absent token =
    number-only display, no title line. */
export const CHAPTER_TITLES: Record<string, string> = {
  '90': 'Motor Vehicles and Aircraft',
  '265': 'Crimes Against the Person',
  '266': 'Crimes Against Property',
  '94C': 'Controlled Substances Act',
  '269': 'Crimes Against Public Peace',
  '272': 'Crimes Against Chastity, Morality, Decency and Good Order',
  '268': 'Crimes Against Public Justice',
  '275': 'Proceedings to Prevent Crimes',
  '89': 'Law of the Road',
  '209A': 'Abuse Prevention',
  '267': 'Forgery and Crimes Against the Currency',
  '274': 'Felonies, Accessories and Attempts to Commit Crimes',
  '234A': 'Office of Jury Commissioner for the Commonwealth',
  '138': 'Alcoholic Liquors',
  '276': 'Search Warrants, Rewards, Fugitives From Justice, Arrest, Examination, Commitment and Bail. Probation Officers and Board of Probation',
  '140': 'Licenses',
  '159A': 'Common Carriers of Passengers by Motor Vehicle',
  '40': 'Powers and Duties of Cities and Towns',
  '151A': 'Unemployment Insurance',
  '90B': 'Motorboats, Other Vessels and Recreational Vehicles',
  '22E': 'State DNA Database',
  '270': 'Crimes Against Public Health',
  '85': 'Regulations and By-Laws Relative to Ways and Bridges',
  '127': 'Officers and Inmates of Penal and Reformatory Institutions. Paroles and Pardons',
  '271': 'Crimes Against Public Policy',
  '159': 'Common Carriers',
  '101': 'Transient Vendors, Hawkers and Pedlers',
  '148': 'Fire Prevention',
  '112': 'Registration of Certain Professions and Occupations',
  '267A': 'Money Laundering',
  '131': 'Inland Fisheries and Game and Other Natural Resources',
  '64C': 'Cigarette Excise',
  '160': 'Railroads',
  '119': 'Protection and Care of Children, and Proceedings Against Them',
  '62C': 'Administrative Provisions Relative to State Taxation',
  '140D': 'Consumer Credit Cost Disclosure',
  '130': 'Marine Fish and Fisheries',
  '268A': 'Conduct of Public Officials and Employees',
  '161A': 'Massachusetts Bay Transportation Authority',
  '149': 'Labor and Industries',
  '118E': 'Division of Medical Assistance',
  '161': 'Street Railways',
  '90D': 'Motor Vehicle Certificates of Title',
  // c. 234 (Juries) was repealed by St. 2016, c. 36; the title and link
  // below remain valid for historical charges filed while it was in force.
  '234': 'Juries',
  '94G': 'Regulation of the Use and Distribution of Marijuana Not Medically Prescribed',
  '90C': 'Procedure for Motor Vehicle Offenses',
};

export const CHAPTER_PROVENANCE: string =
  "Chapter parsed from each charge's statute code. Charges whose code carries no chapter (catch-all and legacy codes) are grouped under \"No statute code\".";

const CHAPTER_VALUE_RE = /^c\.\s*(.+)$/;

/** 'c. 94C' -> '94C'; null for NO_CODE_VALUE or an unparseable value. */
function tokenFromValue(value: string): string | null {
  if (value === NO_CODE_VALUE) return null;
  const m = CHAPTER_VALUE_RE.exec(value);
  return m ? m[1] : null;
}

/** 'c. 265' -> its official title, or null when unmapped. */
export function chapterTitle(value: string): string | null {
  const token = tokenFromValue(value);
  if (token === null) return null;
  return CHAPTER_TITLES[token] ?? null;
}

/** Chapter tokens SCDAO's codes carry that are not the real statute's
    chapter: 258 is truncated 258E (harassment prevention orders), 279C /
    269C are miscodings of c. 279 s. 25 and c. 269 s. 10, and 369 is a
    legacy code with no such chapter. They get no link and no title. */
const MISCODED_TOKENS = new Set(['258', '279C', '269C', '369']);

/** Every token here had its GoTo URL fetched against malegislature.gov on
    2026-08-15 and confirmed to resolve to a real chapter page. Links are
    allowlist-only: a token absent from this set renders WITHOUT a link
    (the spec's rule is that a dead link never ships), so new tokens
    arriving with future data are unlinked until someone verifies them
    and adds them here. */
const VERIFIED_TOKENS = new Set([
  '1', '2', '6', '7', '9', '10', '12', '18', '21', '31', '33', '40', '42',
  '46', '55', '56', '68', '6A', '81', '82', '85', '87', '89', '90', '91',
  '92', '93', '94', '101', '102', '111', '112', '114', '118', '119', '120',
  '126', '127', '130', '131', '138', '139', '140', '141', '143', '148',
  '149', '151', '152', '155', '156', '159', '160', '161', '162', '164',
  '166', '175', '181', '185', '186', '19A', '208', '218', '21A', '21C',
  '21E', '221', '224', '22E', '233', '234', '264', '265', '266', '267',
  '268', '269', '270', '271', '272', '273', '274', '275', '276', '28A',
  '62C', '64C', '64F', '64K', '90B', '90C', '90D', '90F', '94C', '94G',
  '111B', '111C', '118E', '119A', '128A', '140D', '142A', '151A', '151D',
  '159A', '159B', '161A', '167A', '169A', '175E', '175H', '175I', '209A',
  '234A', '255E', '258B', '267A', '268A', '268B',
]);

/** null for NO_CODE_VALUE and any unverified token; otherwise the
    malegislature.gov chapter link. */
export function chapterHref(value: string): string | null {
  const token = tokenFromValue(value);
  if (token === null || !VERIFIED_TOKENS.has(token)) return null;
  return `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=${token}`;
}

/** 'c. 265' | 'c. 265 + c. 267' | 'c. 265 + 2 more'. Mirrors
    severitySummary's shape and dtpModel.summaryLabel's two-selection
    behavior: two selections join both names; three or more collapse to a
    count. */
export function chapterSummary(selected: string[]): string {
  if (selected.length === 0) return 'any';
  if (selected.length === 1) return selected[0];
  if (selected.length === 2) return `${selected[0]} + ${selected[1]}`;
  return `${selected[0]} + ${selected.length - 1} more`;
}

/** Case-insensitive substring match on the value ('265', 'c. 265') and on
    the mapped title; empty query returns rows unchanged. Pure: no mutation
    of the input array. */
export function filterChapters(
  rows: { value: string; count: number }[],
  query: string,
): { value: string; count: number }[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => {
    if (r.value.toLowerCase().includes(q)) return true;
    const title = chapterTitle(r.value);
    return title !== null && title.toLowerCase().includes(q);
  });
}
