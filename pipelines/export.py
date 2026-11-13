import json
from pathlib import Path

import pandas as pd
import pandera as pa

PROCESSED = Path("data/processed")
OUT = Path("app/data")

costs_schema = pa.DataFrameSchema({
    "city": pa.Column(str),
    "area": pa.Column(str, nullable=True),
    "category": pa.Column(str, pa.Check.isin(["rent", "utilities", "transport", "food"])),
    "item": pa.Column(str),
    "value": pa.Column(float, pa.Check.ge(0)),
    "unit": pa.Column(str),
    "source": pa.Column(str),
    "source_url": pa.Column(str, nullable=True),
    "as_of_date": pa.Column(str),
})

condos_schema = pa.DataFrameSchema({
    "id": pa.Column(str, unique=True),
    "developer": pa.Column(str, nullable=True, coerce=True),
    "city": pa.Column(str),
    "area": pa.Column(str),
    "lat": pa.Column(float, pa.Check.in_range(4, 22)),
    "lng": pa.Column(float, pa.Check.in_range(116, 127)),
    "price_per_sqm_low": pa.Column(float, nullable=True),
    "price_per_sqm_high": pa.Column(float, nullable=True),
    "rent_1br_monthly": pa.Column(float, nullable=True),
    "turnover_status": pa.Column(str, pa.Check.isin(["ready", "preselling"]), nullable=True),
    "source": pa.Column(str),
    "as_of_date": pa.Column(str),
    "image_url": pa.Column(str, nullable=True, coerce=True),
    "image_credit": pa.Column(str, nullable=True, coerce=True),
    "image_license": pa.Column(str, nullable=True, coerce=True),
    "image_page": pa.Column(str, nullable=True, coerce=True),
})

def export(name: str, schema: pa.DataFrameSchema):
    df = pd.read_csv(PROCESSED / f"{name}.csv")
    schema.validate(df)  # fails loudly on bad data
    OUT.mkdir(parents=True, exist_ok=True)
    df.to_json(OUT / f"{name}.json", orient="records", indent=2)

if __name__ == "__main__":
    export("costs", costs_schema)
    export("condos", condos_schema)