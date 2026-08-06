#!/usr/bin/env python3
"""Rebuild public/data/hayden.parquet from the assembled CSV.

Usage:  python scripts/prepare_data.py [path-to-csv]
Needs:  pandas, pyarrow  (uv venv && uv pip install pandas pyarrow)

The CSV is produced by ../assembled/build_hayden.py from the original SCDAO
public-records deliveries. This script only converts and types it; it makes
no analytical decisions.
"""
import sys, os
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

HERE = os.path.dirname(os.path.abspath(__file__))
CSV = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    HERE, "..", "..", "assembled", "hayden-era-charges-2022-2025.csv")
OUT = os.path.join(HERE, "..", "public", "data", "hayden.parquet")

DATES = ["filing_date", "offense_date", "disposition_date"]
INTS = ["case_id", "person_id", "count"]
BOOLS = ["filed_in_window", "disposed_in_window"]
CATS = ["charge_code", "crime_type", "court", "race", "sex", "agency",
        "disposition_code", "disposition_description", "disposition_reason",
        "case_status", "filing_source", "disposition_source",
        "filed_under", "disposed_under", "outcome_class", "prosecutorial_call", "dtp_class", "dtp_review", "outcome_detail", "case_disposition_status"]

df = pd.read_csv(CSV, dtype={"icr": "string", "charge_code": "string", "agency": "string"})
for c in DATES:
    df[c] = pd.to_datetime(df[c], errors="coerce")
for c in INTS:
    df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")

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
