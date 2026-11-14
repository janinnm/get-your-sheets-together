"""Validates data/processed/projects.csv and writes the Metro Manila projects to app/data/projects.json."""
from pathlib import Path

import pandas as pd
import pandera.pandas as pa

ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
OUT = ROOT / "app" / "data"

KINDS = ["condo", "townhouse", "house-and-lot", "lot"]
TEXT = {"nullable": True, "coerce": True}

projects_schema = pa.DataFrameSchema({
    "id": pa.Column(str, unique=True),
    "name": pa.Column(str),
    "developer": pa.Column(str),
    "property_type": pa.Column(str, pa.Check.isin(KINDS)),
    "city": pa.Column(str),
    "address": pa.Column(str, **TEXT),
    "lat": pa.Column(float, pa.Check.in_range(14.3, 14.8)),  # Metro Manila
    "lng": pa.Column(float, pa.Check.in_range(120.9, 121.2)),
    "price_low": pa.Column(float, pa.Check.ge(100_000), nullable=True),
    "price_high": pa.Column(float, pa.Check.ge(100_000), nullable=True),
    "monthly_from": pa.Column(float, pa.Check.in_range(1_000, 1_000_000), nullable=True),
    "price_text": pa.Column(str, **TEXT),
    "size_low_sqm": pa.Column(float, pa.Check.gt(0), nullable=True),
    "size_high_sqm": pa.Column(float, pa.Check.gt(0), nullable=True),
    "status": pa.Column(str, pa.Check.isin(["ready", "preselling"]), nullable=True),
    "turnover": pa.Column(str, **TEXT),
    "image_url": pa.Column(str, **TEXT),
    "source_url": pa.Column(str),
    "scraped_at": pa.Column(str),
}, checks=pa.Check(
    lambda df: df["price_low"].isna() | (df["price_low"] <= df["price_high"]),
    error="price_low > price_high",
))


def export_projects():
    df = pd.read_csv(PROCESSED / "projects.csv")
    # The app covers Metro Manila; the scraper's city is set only for points inside it.
    ncr = df[df["city"].notna() & df["lat"].notna() & df["property_type"].notna()].copy()
    ncr = projects_schema.validate(ncr)  # fails loudly on bad data
    OUT.mkdir(parents=True, exist_ok=True)
    ncr.to_json(OUT / "projects.json", orient="records", indent=2, force_ascii=False)
    print(f"Exported {len(ncr)} of {len(df)} projects (Metro Manila only)")


if __name__ == "__main__":
    export_projects()
