"""Shared paths and pandera schemas for the project pipelines.

One module so the scraper, the merge step and the exporter agree on what a
project row looks like. Each stage tightens the rules:

    scraped_schema     what scrape_developers.py may produce. A developer page
                       often has no coordinates and no recognisable city.
    processed_schema   after build_projects.py merges in hand-entered data and
                       stamps where each price came from.
    export_schema      what reaches the app: Metro Manila, real coordinates,
                       a known property type.

Each file has exactly one writer:

    data/interim/projects_scraped.csv    scrape_developers.py
    data/sources/project_overrides.csv   you, by hand (no script writes it)
    data/processed/projects.csv          build_projects.py
    app/data/projects.json               export.py
"""
from pathlib import Path

import pandera.pandas as pa

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

SOURCES = DATA / "sources"
INTERIM = DATA / "interim"
PROCESSED = DATA / "processed"
SNAPSHOTS = DATA / "raw" / "developers"
GEOCODE_CACHE = DATA / "raw" / "geocode_cache.json"
APP_DATA = ROOT / "app" / "data"

SCRAPED_CSV = INTERIM / "projects_scraped.csv"
OVERRIDES_CSV = SOURCES / "project_overrides.csv"
PROJECTS_CSV = PROCESSED / "projects.csv"
PROJECTS_JSON = APP_DATA / "projects.json"

KINDS = ["condo", "townhouse", "house-and-lot", "lot"]
STATUSES = ["ready", "preselling"]

#: Where a row's price came from. The app can badge on this.
#:   verified  a developer price list or agent quote, entered by hand
#:   scraped   published on the developer's own website: an asking price
#:   none      nothing published; the app asks the user for a number instead
PRICE_SOURCES = ["verified", "scraped", "none"]

#: Columns the scraper produces, in file order.
SCRAPED_FIELDS = [
    "id", "name", "developer", "property_type", "city", "address", "lat", "lng",
    "price_low", "price_high", "monthly_from", "price_text",
    "size_low_sqm", "size_high_sqm", "status", "turnover", "image_url",
    "source_url", "scraped_at",
]

#: Columns build_projects.py adds.
PROVENANCE_FIELDS = ["price_source", "price_as_of", "price_note"]

PROCESSED_FIELDS = SCRAPED_FIELDS + PROVENANCE_FIELDS

#: Columns you may set by hand in data/sources/project_overrides.csv. A blank
#: cell there falls through to the scraped value.
OVERRIDE_FIELDS = [
    "id",
    "price_low", "price_high", "monthly_from", "price_text",
    "size_low_sqm", "size_high_sqm",
    "status", "turnover",
    "city", "address", "lat", "lng",
    "price_as_of", "price_note",
]

#: Setting any of these in an override marks the row's price as verified.
PRICE_FIELDS = ["price_low", "price_high", "monthly_from", "price_text"]

# A point outside the Philippines is a bad pin on the developer's page, not a
# project we simply don't cover, so it is reported rather than quietly dropped.
PH_LAT, PH_LNG = (4.5, 21.5), (116.0, 127.0)
NCR_LAT, NCR_LNG = (14.3, 14.8), (120.9, 121.2)

# A failed price parse still looks like a number, so bound it. The dearest
# project scraped so far is ~P48M (Oak Harbor Residences).
PRICE_MIN, PRICE_MAX = 100_000, 500_000_000
MONTHLY_MIN, MONTHLY_MAX = 1_000, 1_000_000

#: A verified price older than this gets a warning from build_projects.py.
STALE_AFTER_DAYS = 183

TEXT = {"nullable": True, "coerce": True}


def _coords(lat_range, lng_range, nullable):
    return {
        "lat": pa.Column(float, pa.Check.in_range(*lat_range), nullable=nullable),
        "lng": pa.Column(float, pa.Check.in_range(*lng_range), nullable=nullable),
    }


# Columns every stage shares. Checks on a nullable column only look at rows
# that have a value, so a blank price is never a failure.
_COMMON = {
    "id": pa.Column(str, unique=True),
    "name": pa.Column(str),
    "developer": pa.Column(str),
    "address": pa.Column(str, **TEXT),
    "price_low": pa.Column(float, pa.Check.in_range(PRICE_MIN, PRICE_MAX), nullable=True),
    "price_high": pa.Column(float, pa.Check.in_range(PRICE_MIN, PRICE_MAX), nullable=True),
    "monthly_from": pa.Column(float, pa.Check.in_range(MONTHLY_MIN, MONTHLY_MAX), nullable=True),
    "price_text": pa.Column(str, **TEXT),
    "size_low_sqm": pa.Column(float, pa.Check.gt(0), nullable=True),
    "size_high_sqm": pa.Column(float, pa.Check.gt(0), nullable=True),
    "status": pa.Column(str, pa.Check.isin(STATUSES), nullable=True),
    "turnover": pa.Column(str, **TEXT),
    "image_url": pa.Column(str, **TEXT),
    "source_url": pa.Column(str),
    "scraped_at": pa.Column(str),
}

_PROVENANCE = {
    "price_source": pa.Column(str, pa.Check.isin(PRICE_SOURCES)),
    "price_as_of": pa.Column(str, **TEXT),
    "price_note": pa.Column(str, **TEXT),
}

_PRICE_ORDER = pa.Check(
    lambda df: df["price_low"].isna()
    | df["price_high"].isna()
    | (df["price_low"] <= df["price_high"]),
    error="price_low > price_high",
)

# price_source must agree with the price columns, or the app would badge an
# empty row as confirmed, or hide a price that is there.
_SOURCE_MATCHES_PRICE = [
    pa.Check(
        lambda df: (df["price_source"] == "none")
        | df["price_low"].notna()
        | df["monthly_from"].notna(),
        error="price_source says there is a price, but price_low and monthly_from are blank",
    ),
    pa.Check(
        lambda df: (df["price_source"] != "none")
        | (df["price_low"].isna() & df["monthly_from"].isna()),
        error="price_source=none but a price is present",
    ),
]

scraped_schema = pa.DataFrameSchema(
    {
        **_COMMON,
        # The scraper can't always place or classify a page.
        "property_type": pa.Column(str, pa.Check.isin(KINDS), nullable=True),
        "city": pa.Column(str, **TEXT),
        # Not range-checked here: build_projects.py reports and clears bad pins.
        "lat": pa.Column(float, nullable=True),
        "lng": pa.Column(float, nullable=True),
    },
    checks=[_PRICE_ORDER],
)

processed_schema = pa.DataFrameSchema(
    {
        **_COMMON,
        "property_type": pa.Column(str, pa.Check.isin(KINDS), nullable=True),
        "city": pa.Column(str, **TEXT),
        **_coords(PH_LAT, PH_LNG, nullable=True),
        **_PROVENANCE,
    },
    checks=[_PRICE_ORDER, *_SOURCE_MATCHES_PRICE],
)

export_schema = pa.DataFrameSchema(
    {
        **_COMMON,
        # Everything reaching the app is a placed, typed Metro Manila project.
        "property_type": pa.Column(str, pa.Check.isin(KINDS)),
        "city": pa.Column(str),
        **_coords(NCR_LAT, NCR_LNG, nullable=False),
        **_PROVENANCE,
    },
    checks=[_PRICE_ORDER, *_SOURCE_MATCHES_PRICE],
)
