#!/usr/bin/env python3
"""Ground truths for the Severity and Statute chapter filter modals.

Runs against the two ASSEMBLED CSVs, not the parquets the app reads, and
recomputes both derived columns independently of the two prep scripts
(scripts/prepare_data.py, scripts/prepare_history.py) that build them:

- severity_class exists as a real column only in the 2022-2025 assembled
  CSV (hayden-era-charges-2022-2025.csv); the pre-2022 composite carries no
  severity_class column at all. prepare_history.py stamps the constant
  "Not graded (pre-2022)" onto every row of the composite when it builds
  history.parquet, so this script's ground truth for that constant is
  simply the composite's total row count (scenario 5 below), not a
  filtered query.
- statute_chapter exists in neither assembled CSV; both prep scripts derive
  it from charge_code with the same regex, applied here independently:
  ^([0-9]+[A-Z]?)[/.] on the trimmed code -> "c. " + token, else
  "No statute code".

Path note: this script lives in docs/specs/, two directories below the repo
root (suffolk-explorer/), which itself sits inside data/ alongside
assembled/. So the assembled CSVs are three levels up from this file's
directory (../../../assembled/...), not two; the task brief's shorthand
"../../assembled/" describes the path from docs/, not from docs/specs/.
Confirmed by `ls` before writing this script.
"""
import duckdb

d = duckdb.connect()
HAYDEN = "read_csv_auto('../../../assembled/hayden-era-charges-2022-2025.csv')"
COMPOSITE = "read_csv_auto('../../../assembled/pre-2022-composite.csv')"

# Same rule as scripts/prepare_data.py / scripts/prepare_history.py,
# expressed in SQL rather than pandas.
CHAPTER_EXPR = """
  CASE WHEN regexp_matches(trim(charge_code), '^[0-9]+[A-Z]?[/.]')
       THEN 'c. ' || regexp_extract(trim(charge_code), '^([0-9]+[A-Z]?)[/.]', 1)
       ELSE 'No statute code' END
"""


def run(label, sql):
    print(f"=== {label} ===")
    rows = d.sql(sql).fetchall()
    tot = sum(r[-1] for r in rows)
    for r in rows:
        key = ' | '.join(str(x) for x in r[:-1])
        print(f"  {key:<48}{r[-1]:>10,}")
    print(f"  {'TOTAL':<48}{tot:>10,}")
    return rows


# --- 1. Severity counts overall (2022-2025 file; severity_class is a
# pass-through column there, no filter applied) ---
run(
    "1. Severity counts overall (hayden-era CSV, all rows)",
    f"SELECT severity_class, count(*) FROM {HAYDEN} GROUP BY 1 ORDER BY 1",
)

# --- 2. Severity x dtp_class YY ---
run(
    "2. Severity x dtp_class YY (hayden-era CSV, dtp_class LIKE 'YY%')",
    f"SELECT severity_class, count(*) FROM {HAYDEN} "
    f"WHERE dtp_class LIKE 'YY%' GROUP BY 1 ORDER BY 1",
)

# --- 3. Severity for court = Suffolk Superior Court ---
run(
    "3. Severity for court = Suffolk Superior Court (hayden-era CSV)",
    f"SELECT severity_class, count(*) FROM {HAYDEN} "
    f"WHERE court = 'Suffolk Superior Court' GROUP BY 1 ORDER BY 1",
)

# --- 4. Chapter counts, top 10 + No statute code (hayden-era CSV; chapter
# rule recomputed independently of prepare_data.py) ---
chapter_rows = run(
    "4a. Chapter counts, ALL chapters, hayden-era CSV (chapter rule recomputed)",
    f"SELECT {CHAPTER_EXPR} AS chapter, count(*) AS n FROM {HAYDEN} "
    f"GROUP BY 1 ORDER BY n DESC",
)
print("=== 4b. Chapter counts, top 10 by volume (hayden-era CSV) ===")
top10 = [r for r in chapter_rows if r[0] != 'No statute code'][:10]
for chapter, n in top10:
    print(f"  {chapter:<48}{n:>10,}")
no_code = next((n for c, n in chapter_rows if c == 'No statute code'), 0)
print(f"  {'No statute code':<48}{no_code:>10,}")
print(f"  {'distinct chapter values total (incl. No statute code)':<48}{len(chapter_rows):>10,}")

# Extra, not in the brief's list but useful: the same chapter rule applied
# to BOTH assembled files combined, since statute_chapter is derived
# identically in both prep scripts and the UI's chapter filter covers
# either dataset depending on the history toggle.
run(
    "4c. EXTRA: chapter counts, top 10, hayden-era + pre-2022 composite combined",
    f"""
    SELECT chapter, sum(n) AS n FROM (
      SELECT {CHAPTER_EXPR} AS chapter, count(*) AS n FROM {HAYDEN} GROUP BY 1
      UNION ALL
      SELECT {CHAPTER_EXPR} AS chapter, count(*) AS n FROM {COMPOSITE} GROUP BY 1
    ) GROUP BY 1 ORDER BY n DESC LIMIT 11
    """,
)

# --- 5. History row count as the Not-graded count (pre-2022 composite has
# no severity_class column; prepare_history.py stamps the constant
# "Not graded (pre-2022)" onto every one of its rows unconditionally, so
# the ground truth is simply the file's total row count) ---
print("=== 5. History row count = the 'Not graded (pre-2022)' severity count ===")
history_total = d.sql(f"SELECT count(*) FROM {COMPOSITE}").fetchone()[0]
print(f"  {'Not graded (pre-2022)':<48}{history_total:>10,}")

# --- 6. Severity counts under filed_under = Hayden ---
run(
    "6. Severity counts under filed_under = Hayden (hayden-era CSV)",
    f"SELECT severity_class, count(*) FROM {HAYDEN} "
    f"WHERE filed_under = 'Hayden' GROUP BY 1 ORDER BY 1",
)
