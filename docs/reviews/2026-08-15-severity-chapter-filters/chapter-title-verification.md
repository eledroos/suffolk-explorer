# Chapter title verification worksheet

Source file: `2026-08-03 Suffolk DA/data/suffolk-explorer/src/ui/chapterModel.ts`
`CHAPTER_TITLES` map, 46 entries. Verified against `malegislature.gov` on
2026-08-15.

Method: fetched `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=<token>`
for every token via WebFetch. All 46 requests returned a 302 redirect to a
live `/Laws/GeneralLaws/PartX/TitleY/ChapterN` page (confirmed for chapter 85
via raw `curl`; the pattern is consistent) on the first attempt, so no retries
or UNVERIFIED/URL-DEAD outcomes occurred. Two mismatches were confirmed
against raw HTML (`grep -n "genLawHeading"`) rather than taken on the
WebFetch summarizer's word.

## Worksheet

| Token | Map title | Site title (title-cased) | Verdict |
|---|---|---|---|
| 90 | Motor Vehicles and Aircraft | Motor Vehicles and Aircraft | MATCH |
| 265 | Crimes Against the Person | Crimes Against the Person | MATCH |
| 266 | Crimes Against Property | Crimes Against Property | MATCH |
| 94C | Controlled Substances Act | Controlled Substances Act | MATCH |
| 269 | Crimes Against Public Peace | Crimes Against Public Peace | MATCH |
| 272 | Crimes Against Chastity, Morality, Decency and Good Order | Crimes Against Chastity, Morality, Decency and Good Order | MATCH |
| 268 | Crimes Against Public Justice | Crimes Against Public Justice | MATCH |
| 275 | Proceedings to Prevent Crimes | Proceedings to Prevent Crimes | MATCH |
| 89 | Law of the Road | Law of the Road | MATCH |
| 209A | Abuse Prevention | Abuse Prevention | MATCH |
| 267 | Forgery and Crimes Against the Currency | Forgery and Crimes Against the Currency | MATCH |
| 274 | Felonies, Accessories and Attempts to Commit Crimes | Felonies, Accessories and Attempts to Commit Crimes | MATCH |
| 234A | Office of Jury Commissioner for the Commonwealth | Office of Jury Commissioner for the Commonwealth | MATCH |
| 138 | Alcoholic Liquors | Alcoholic Liquors | MATCH |
| 276 | Search Warrants, Rewards, Fugitives From Justice, Arrest, Examination, Commitment and Bail. Probation Officers and Board of Probation | Search Warrants, Rewards, Fugitives From Justice, Arrest, Examination, Commitment and Bail. Probation Officers and Board of Probation | MATCH |
| 140 | Licenses | Licenses | MATCH |
| 159A | Common Carriers of Passengers by Motor Vehicle | Common Carriers of Passengers by Motor Vehicle | MATCH |
| 40 | Powers and Duties of Cities and Towns | Powers and Duties of Cities and Towns | MATCH |
| 151A | Unemployment Insurance | Unemployment Insurance | MATCH |
| 90B | Motorboats, Other Vessels and Recreational Vehicles | Motorboats, Other Vessels and Recreational Vehicles | MATCH |
| 22E | State DNA Database | State DNA Database | MATCH |
| 270 | Crimes Against Public Health | Crimes Against Public Health | MATCH |
| 85 | Regulations and By-Laws Relative to Ways and Bridges | Regulations and By-Laws Relative to Ways and Bridges | MATCH (see note 1) |
| 127 | Officers and Inmates of Correctional Institutions. Paroles and Pardons | Officers and Inmates of **Penal and Reformatory Institutions**. Paroles and Pardons | **MISMATCH** |
| 271 | Crimes Against Public Policy | Crimes Against Public Policy | MATCH |
| 159 | Common Carriers | Common Carriers | MATCH |
| 101 | Transient Vendors, Hawkers and Pedlers | Transient Vendors, Hawkers and Pedlers | MATCH |
| 148 | Fire Prevention | Fire Prevention | MATCH |
| 112 | Registration of Certain Professions and Occupations | Registration of Certain Professions and Occupations | MATCH |
| 267A | Money Laundering | Money Laundering | MATCH |
| 131 | Inland Fisheries and Game and Other Natural Resources | Inland Fisheries and Game and Other Natural Resources | MATCH |
| 64C | Cigarette Excise | Cigarette Excise | MATCH |
| 160 | Railroads | Railroads | MATCH |
| 119 | Protection and Care of Children, and Proceedings Against Them | Protection and Care of Children, and Proceedings Against Them | MATCH |
| 62C | Administration of Taxes | **Administrative Provisions Relative to State Taxation** | **MISMATCH** |
| 140D | Consumer Credit Cost Disclosure | Consumer Credit Cost Disclosure | MATCH |
| 130 | Marine Fish and Fisheries | Marine Fish and Fisheries | MATCH |
| 268A | Conduct of Public Officials and Employees | Conduct of Public Officials and Employees | MATCH |
| 161A | Massachusetts Bay Transportation Authority | Massachusetts Bay Transportation Authority | MATCH |
| 149 | Labor and Industries | Labor and Industries | MATCH |
| 118E | Division of Medical Assistance | Division of Medical Assistance | MATCH |
| 161 | Street Railways | Street Railways | MATCH |
| 90D | Motor Vehicle Certificates of Title | Motor Vehicle Certificates of Title | MATCH |
| 234 | Juries | Juries | MATCH (see note 2) |
| 94G | Regulation of the Use and Distribution of Marijuana Not Medically Prescribed | Regulation of the Use and Distribution of Marijuana Not Medically Prescribed | MATCH |
| 90C | Procedure for Motor Vehicle Offenses | Procedure for Motor Vehicle Offenses | MATCH |

## Absent tokens (step 3)

- `'258'` — confirmed absent from `CHAPTER_TITLES` (`grep -n "'258'"` returns
  no match). Consistent with the file's own comment that SCDAO truncates
  258E to 258.
- `'279C'` — confirmed absent from `CHAPTER_TITLES` (`grep -n "'279C'"`
  returns no match). Consistent with the file's comment that SCDAO miscodes
  279 as 279C.
- No fetches were needed for these two per the task instructions (file-only
  check).

## Lettered-chapter edge cases (step 4)

`90C`, `94G`, `267A`, `234A` are **not actually absent from the map** — all
four are present as keys in `CHAPTER_TITLES` (the task description's premise
that they "might be edge cases even if absent from the map" does not hold for
this file; see the worksheet rows above). All four resolved correctly through
the `GoTo?ChapterGoTo=<token>` pattern to their live chapter pages, confirming
the URL builder works for lettered-suffix tokens, not just bare numbers.

## URL pattern verification

`chapterHref`'s pattern, `https://malegislature.gov/Laws/GeneralLaws/GoTo?ChapterGoTo=<token>`,
resolved for all 46 tokens tested (bare numeric like `90`, and lettered like
`94C`, `209A`, `90B`, `118E`, `140D`, `159A`, `161A`, `268A`, `267A`, `234A`,
`90C`, `90D`, `22E`, `64C`). Raw `curl` confirmed the mechanism: the `GoTo`
endpoint issues an HTTP 302 to `/Laws/GeneralLaws/Part{I|II|III|IV}/Title{N}/Chapter{token}`,
which serves the actual chapter content. No URL pattern failures found.

## Notes

1. **Chapter 85** — the live page's raw HTML source contains a double-encoded
   HTML entity: `REGULATIONS AND BY&amp;ndash;LAWS RELATIVE TO WAYS AND
   BRIDGES` (confirmed via `curl` + `grep -n "genLawHeading"` on the raw
   response, saved during this session). A single pass of entity-decoding,
   which is what a standard browser applies, turns `&amp;ndash;` into the
   literal text `&ndash;` (not an en dash). So the state's own page markup is
   bugged and, in a normal browser, would display the visible text
   `BY&ndash;LAWS` rather than either `By-Laws` or `By–Laws`. Only a tool that
   decodes entities twice (as this session's WebFetch summarizer apparently
   did) renders it as `By–Laws` with an actual en dash. Given the bug is
   clearly unintentional markup breakage and not an editorial choice, the
   map's plain-hyphen `By-Laws` is treated as a MATCH against the evident
   intended title, not a mismatch. Flagging this for awareness rather than as
   a title problem.
2. **Chapter 234** — title "Juries" matches, but the chapter page itself
   states the chapter was repealed by St. 2016, c. 36, § 1. The GoTo URL
   still resolves and the historical title is still printed on the page, so
   this is not a URL-pattern failure or a title mismatch, just a fact worth
   knowing if the explorer ever links to it expecting live statutory text.

## Counts

- MATCH: 44
- MISMATCH: 2 (chapter 127, chapter 62C)
- UNVERIFIED: 0
- URL-DEAD: 0
- Total tokens checked: 46 (all entries in `CHAPTER_TITLES`)

## Mismatches requiring a fix in the source file

| Token | Current map title | Official malegislature.gov title |
|---|---|---|
| 127 | Officers and Inmates of Correctional Institutions. Paroles and Pardons | Officers and Inmates of Penal and Reformatory Institutions. Paroles and Pardons |
| 62C | Administration of Taxes | Administrative Provisions Relative to State Taxation |
