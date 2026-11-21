"""Validates data/processed/projects.csv and writes the Metro Manila projects to app/data/projects.json.

Usage: python pipelines/export.py
"""
import pandas as pd

from schema import PROCESSED_FIELDS, PROJECTS_CSV, PROJECTS_JSON, ROOT, export_schema, processed_schema


def export_projects():
    df = processed_schema.validate(pd.read_csv(PROJECTS_CSV), lazy=True)

    # The app covers Metro Manila. The scraper sets `city` only for points inside it,
    # so a blank city means "elsewhere in the Philippines", which is expected.
    reasons = {
        "outside Metro Manila": df["city"].isna(),
        "in Metro Manila but no map pin (add lat/lng in data/sources/project_overrides.csv)":
            df["city"].notna() & df["lat"].isna(),
        "no property type": df["city"].notna() & df["lat"].notna() & df["property_type"].isna(),
    }
    keep = ~pd.concat(reasons.values(), axis=1).any(axis=1)
    ncr = export_schema.validate(df[keep][PROCESSED_FIELDS], lazy=True)  # fails loudly on bad data

    PROJECTS_JSON.parent.mkdir(parents=True, exist_ok=True)
    ncr.to_json(PROJECTS_JSON, orient="records", indent=2, force_ascii=False)

    print(f"Exported {len(ncr)} of {len(df)} projects to {PROJECTS_JSON.relative_to(ROOT)}")
    for reason, mask in reasons.items():
        if mask.any():
            ids = df.loc[mask, "id"].tolist()
            sample = ", ".join(ids[:4]) + (", ..." if len(ids) > 4 else "")
            print(f"  skipped {len(ids)}, {reason}: {sample}")


if __name__ == "__main__":
    export_projects()
