#!/usr/bin/env python3
"""Convert pre-2022-composite.csv to public/data/history.parquet.
Same typing rules as prepare_data.py. The composite carries real DAMION
case/person IDs (no anonymization offset), so distinct counts dedupe
across the 2021/2022 seam."""
import os, sys
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    HERE, "..", "..", "assembled", "pre-2022-composite.csv")
OUT = os.path.join(HERE, "..", "public", "data", "history.parquet")

DATES = ["filing_date", "offense_date", "disposition_date"]
INTS = ["case_id", "person_id", "count"]
BOOLS = ["filed_in_window", "disposed_in_window"]
CATS = ["charge_code", "crime_type", "court", "race", "sex", "agency",
        "disposition_code", "disposition_description", "disposition_reason",
        "case_status", "filing_source", "disposition_source",
        "filed_under", "disposed_under", "outcome_class", "prosecutorial_call",
        "dtp_class", "dtp_review", "outcome_detail", "case_disposition_status",
        "severity_class", "statute_chapter"]

# statute_chapter: same rule as prepare_data.py, see the comment there.
# severity_class: the pre-2022 composite is deliberately ungraded (the MCL
# states current law; 2006-2021 charges were filed under different
# thresholds — assembled README, limitation 8). An explicit constant keeps
# these rows visible in severity charts and filters instead of vanishing as
# nulls.
# Two code formats appear: DAMION slash codes ("266/30/C") and MassCourts
# dot codes ("265.13A"); the chapter is the token before the first separator.
CHAPTER_RE = r"^([0-9]+[A-Z]?)[/.]"
SEVERITY_CONST = "Not graded (pre-2022)"

df = pd.read_csv(CSV, dtype={"icr": "string", "charge_code": "string", "agency": "string"})
for c in DATES:
    df[c] = pd.to_datetime(df[c], errors="coerce")
for c in INTS:
    df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")

chap = df["charge_code"].fillna("").str.strip().str.extract(CHAPTER_RE, expand=False)
df["statute_chapter"] = ("c. " + chap).fillna("No statute code")
df["severity_class"] = SEVERITY_CONST

import re as _re
recount = sum(1 for v in df["charge_code"].fillna("") if not _re.match(CHAPTER_RE, v.strip()))
got = int((df["statute_chapter"] == "No statute code").sum())
if recount != got:
    raise SystemExit(f"GATE FAIL: No-statute-code recount {recount} != column {got}")
if (df["severity_class"] != SEVERITY_CONST).any():
    raise SystemExit("GATE FAIL: severity_class constant violated")
print(f"gates ok: no-statute-code {got:,}; severity constant on {len(df):,} rows")

arrs = {}
for c in df.columns:
    if c in DATES:
        arrs[c] = pa.array(df[c].dt.date, type=pa.date32())
    elif c in INTS:
        arrs[c] = pa.array(df[c], type=pa.int32())
    elif c in BOOLS:
        arrs[c] = pa.array(df[c].astype(bool), type=pa.bool_())
    elif c in CATS:
        arrs[c] = pa.array(df[c].astype("string")).dictionary_encode()
    else:
        arrs[c] = pa.array(df[c].astype("string"))

t = pa.table(arrs)
pq.write_table(t, OUT, compression="zstd", compression_level=9)
print(f"wrote {OUT}: {os.path.getsize(OUT)/1e6:.1f} MB, {t.num_rows:,} rows, {t.num_columns} cols")
