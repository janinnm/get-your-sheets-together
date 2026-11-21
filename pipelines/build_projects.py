"""Merges scraped projects with hand-entered data into data/processed/projects.csv.

This is the only script that writes data/processed/projects.csv.

    data/interim/projects_scraped.csv     scrape_developers.py writes it
    data/sources/project_overrides.csv    you write it, by hand
        -> data/processed/projects.csv

Overrides are matched on `id`. A filled cell replaces the scraped value and a
blank cell keeps it, except for prices: filling any price column takes all of
them from the override, so a row never mixes your numbers with scraped ones,
and marks the row `price_source=verified`.

Also clears map pins outside the Philippines (a developer page occasionally
embeds a wrong one) and prints everything it changed, so bad data shows up here
instead of vanishing in a filter later.

Usage: python pipelines/build_projects.py
"""
import io
import sys
from datetime import date, timedelta

import pandas as pd

from schema import (
    OVERRIDE_FIELDS, OVERRIDES_CSV, PH_LAT, PH_LNG, PRICE_FIELDS, PROCESSED_FIELDS,
    PROJECTS_CSV, ROOT, SCRAPED_CSV, STALE_AFTER_DAYS, processed_schema, scraped_schema,
)

NUMERIC = ["price_low", "price_high", "monthly_from", "size_low_sqm", "size_high_sqm", "lat", "lng"]


def fail(msg: str):
    sys.exit(f"build_projects: {msg}")


def read_overrides() -> pd.DataFrame:
    """The override file, with comment lines removed and numbers parsed strictly."""
    if not OVERRIDES_CSV.exists():
        return pd.DataFrame(columns=OVERRIDE_FIELDS)
    # Skip whole-line comments only: '#' is legitimate inside a value ('#6 Scout Tuason Ave.').
    lines = [l for l in OVERRIDES_CSV.read_text(encoding="utf-8").splitlines() if not l.lstrip().startswith("#")]
    ov = pd.read_csv(io.StringIO("\n".join(lines)), dtype=str, skipinitialspace=True)
    ov = ov.apply(lambda s: s.str.strip()).replace("", pd.NA)

    unknown = set(ov.columns) - set(OVERRIDE_FIELDS)
    if unknown:
        fail(f"{OVERRIDES_CSV.name} has columns that can't be overridden: {sorted(unknown)}. "
             f"Allowed: {OVERRIDE_FIELDS}")
    if "id" not in ov.columns:
        fail(f"{OVERRIDES_CSV.name} needs an `id` column")
    dupes = ov["id"][ov["id"].duplicated()].tolist()
    if dupes:
        fail(f"{OVERRIDES_CSV.name} lists these ids more than once: {dupes}")

    for col in NUMERIC:
        if col in ov.columns:
            parsed = pd.to_numeric(ov[col].str.replace(",", ""), errors="coerce")
            bad = ov.loc[ov[col].notna() & parsed.isna(), ["id", col]]
            if not bad.empty:
                fail(f"{OVERRIDES_CSV.name}: `{col}` is not a number for {bad.to_dict('records')}")
            ov[col] = parsed
    return ov.reindex(columns=OVERRIDE_FIELDS)


def main():
    if not SCRAPED_CSV.exists():
        fail(f"{SCRAPED_CSV.relative_to(ROOT)} is missing. Run scrape_developers.py first.")
    df = scraped_schema.validate(pd.read_csv(SCRAPED_CSV), lazy=True)
    print(f"Scraped: {len(df)} projects from {SCRAPED_CSV.relative_to(ROOT)}")

    df["price_as_of"] = df["scraped_at"]
    df["price_note"] = pd.NA

    # --- overrides ---
    ov = read_overrides()
    missing = sorted(set(ov["id"]) - set(df["id"]))
    if missing:
        # A typo'd id would otherwise silently change nothing.
        fail(f"{OVERRIDES_CSV.name} has ids that aren't in the scraped data: {missing}")

    ov = ov.set_index("id")
    has_price = ov[PRICE_FIELDS].notna().any(axis=1)
    verified = set(ov.index[has_price])

    no_date = sorted(i for i in verified if pd.isna(ov.at[i, "price_as_of"]))
    if no_date:
        fail(f"{OVERRIDES_CSV.name}: a verified price needs price_as_of (YYYY-MM-DD) for {no_date}")

    is_verified = df["id"].isin(verified)
    for col in ov.columns:
        incoming = df["id"].map(ov[col])
        if col in PRICE_FIELDS:
            # Prices come from the override wholesale: blank there means blank here.
            df[col] = incoming.where(is_verified, df[col])
        else:
            df[col] = incoming.where(incoming.notna(), df[col])
    if len(ov):
        print(f"Overrides: {len(ov)} rows from {OVERRIDES_CSV.relative_to(ROOT)}, "
              f"{len(verified)} with a verified price")

    # --- pins outside the Philippines ---
    lat_ok = df["lat"].between(*PH_LAT)
    lng_ok = df["lng"].between(*PH_LNG)
    bad_pin = df["lat"].notna() & ~(lat_ok & lng_ok)
    for _, r in df[bad_pin].iterrows():
        print(f"  cleared pin outside the Philippines: {r['id']} ({r['lat']:.4f}, {r['lng']:.4f})")
    df.loc[bad_pin, ["lat", "lng"]] = pd.NA

    # --- provenance ---
    has_any_price = df["price_low"].notna() | df["monthly_from"].notna()
    df["price_source"] = "none"
    df.loc[has_any_price, "price_source"] = "scraped"
    df.loc[is_verified, "price_source"] = "verified"

    # --- staleness ---
    as_of = pd.to_datetime(df["price_as_of"], format="%Y-%m-%d", errors="coerce")
    bad_date = df["price_as_of"].notna() & as_of.isna()
    if bad_date.any():
        fail(f"price_as_of is not YYYY-MM-DD for {df.loc[bad_date, 'id'].tolist()}")
    cutoff = pd.Timestamp(date.today() - timedelta(days=STALE_AFTER_DAYS))
    stale = df[is_verified & (as_of < cutoff)]
    for _, r in stale.iterrows():
        print(f"  warning: verified price for {r['id']} is from {r['price_as_of']}, "
              f"over {STALE_AFTER_DAYS} days old. Ask the developer for a new price list.")

    df = processed_schema.validate(df[PROCESSED_FIELDS], lazy=True)
    PROJECTS_CSV.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(PROJECTS_CSV, index=False)

    counts = df["price_source"].value_counts().reindex(["verified", "scraped", "none"], fill_value=0)
    print("Price source: " + ", ".join(f"{k} {v}" for k, v in counts.items()))
    print(f"Wrote {PROJECTS_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
