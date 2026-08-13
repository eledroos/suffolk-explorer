#!/usr/bin/env python3
"""Ground truths for the DTP modal's live counts.

Each scenario mirrors buildCountView: the modal's counts are the aggregate
of the current lens + dates + every NON-DTP filter, grouped by the DTP
column. DTP filters themselves never affect the counts shown.
Compare each block against the modal opened under the same view.

Court value: 'Boston Municipal Court' (real value; the brief's template used
the placeholder 'BMC Central', which does not occur in the data). Confirmed via
    SELECT DISTINCT court, count(*) FROM hayden.parquet GROUP BY 1 ORDER BY 2 DESC
which also gives the two courts used in the hand-added custom-grouping
scenario at the bottom of this file: 'Boston Municipal Court' and
'Dorchester Court', the two highest-volume courts.

filed_in_window / disposed_in_window are BOOLEAN columns in the parquet, so
`WHERE filed_in_window` / `WHERE disposed_in_window` is used directly (no
`= 1` / `= true` needed).
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
    ("filings + court=Boston Municipal Court",
     f"SELECT dtp_class, count(*) FROM {H} WHERE filed_in_window AND court='Boston Municipal Court' GROUP BY 1 ORDER BY 1"),
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

# --- Hand-added: custom-grouping scenario (Step 2 of the brief) ---
# The modal has no direct "grouping" filter of its own; groupings are a UI
# concept (src/contract.ts Grouping, src/engine/aggregate.ts buildFilterTests
# 'g:' key) that resolve to an IN-list over the base column's values. To
# reproduce it in SQL by hand: bucket the two highest-volume courts into one
# custom-grouping bucket ("Central") in the UI, filter the view on that
# bucket, open the DTP modal, and compare against this query, which is the
# same court IN-list expressed directly.
CUSTOM_GROUPING_NAME = (
    "filings + custom grouping 'Court family' bucket 'Central' = "
    "{Boston Municipal Court, Dorchester Court} (hand-added, mirrors a UI grouping filter)"
)
CUSTOM_GROUPING_SQL = (
    f"SELECT dtp_class, count(*) FROM {H} WHERE filed_in_window "
    f"AND court IN ('Boston Municipal Court', 'Dorchester Court') GROUP BY 1 ORDER BY 1"
)
CUSTOM_GROUPING_SQL_REVIEW = (
    f"SELECT dtp_review, count(*) FROM {H} WHERE filed_in_window "
    f"AND court IN ('Boston Municipal Court', 'Dorchester Court') GROUP BY 1 ORDER BY 1"
)
print(f"=== {CUSTOM_GROUPING_NAME} ===")
rows = d.sql(CUSTOM_GROUPING_SQL).fetchall()
tot = sum(r[1] for r in rows)
for r in rows:
    print(f"  {r[0]:<36}{r[1]:>10,}")
print(f"  {'TOTAL':<36}{tot:>10,}")

print(f"=== {CUSTOM_GROUPING_NAME} (review column) ===")
rows = d.sql(CUSTOM_GROUPING_SQL_REVIEW).fetchall()
tot = sum(r[1] for r in rows)
for r in rows:
    print(f"  {r[0]:<36}{r[1]:>10,}")
print(f"  {'TOTAL':<36}{tot:>10,}")
