"""Writes placeholder non-condo listings (townhouses, house and lots, vacant lots)
to data/processed/properties.csv. Prices are PLACEHOLDER area estimates, not real
listings. Replace with a real pipeline later.

Run from the repo root:  .venv/bin/python pipelines/seed_properties.py
"""
import csv
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "processed" / "properties.csv"
AS_OF = "2026-11-01"
SOURCE = "PLACEHOLDER: area estimate, not a real listing"

# id, name, type, city, area, lat, lng, price low, price high, lot sqm, floor sqm, monthly rent, status
# Coordinates are approximate neighbourhood centres.
PROPERTIES = [
    ("th-qc-001",  "Townhouse in Teachers Village",   "townhouse",     "Quezon City", "Teachers Village", 14.6420, 121.0610, 12_000_000, 14_000_000,  60, 120, 35_000, "ready"),
    ("hl-qc-001",  "House and lot in Fairview",       "house-and-lot", "Quezon City", "Fairview",         14.7050, 121.0700,  9_000_000, 11_000_000, 120, 150, 30_000, "ready"),
    ("lt-qc-001",  "Residential lot in Commonwealth", "lot",           "Quezon City", "Commonwealth",     14.6950, 121.0880,  8_000_000, 10_000_000, 200, None, None,  "ready"),
    ("th-pas-001", "Townhouse in Kapitolyo",          "townhouse",     "Pasig",       "Kapitolyo",        14.5720, 121.0590, 15_000_000, 18_000_000,  70, 140, 45_000, "ready"),
    ("hl-pas-001", "House and lot in Rosario",        "house-and-lot", "Pasig",       "Rosario",          14.5880, 121.0890, 11_000_000, 13_000_000, 100, 160, 32_000, "preselling"),
    ("hl-mkt-001", "House in San Antonio Village",    "house-and-lot", "Makati",      "San Antonio",      14.5680, 121.0110, 28_000_000, 32_000_000, 150, 250, 80_000, "ready"),
    ("hl-par-001", "House and lot in BF Homes",       "house-and-lot", "Parañaque",   "BF Homes",         14.4530, 121.0250, 18_000_000, 22_000_000, 200, 220, 55_000, "ready"),
    ("th-lpn-001", "Townhouse in Pamplona",           "townhouse",     "Las Piñas",   "Pamplona",         14.4500, 120.9820,  6_500_000,  7_500_000,  50,  90, 20_000, "preselling"),
    ("lt-lpn-001", "Residential lot in BF Resort",    "lot",           "Las Piñas",   "BF Resort",        14.4330, 120.9960,  5_000_000,  6_000_000, 150, None, None,  "ready"),
    ("hl-mun-001", "House and lot in Tunasan",        "house-and-lot", "Muntinlupa",  "Tunasan",          14.3800, 121.0420,  5_500_000,  6_500_000,  80,  70, 15_000, "preselling"),
    ("lt-mun-001", "Residential lot in Cupang",       "lot",           "Muntinlupa",  "Cupang",           14.4380, 121.0480,  9_000_000, 11_000_000, 180, None, None,  "ready"),
    ("th-man-001", "Townhouse in Hulo",               "townhouse",     "Mandaluyong", "Hulo",             14.5720, 121.0400,  9_500_000, 11_000_000,  55, 110, 28_000, "ready"),
]

HEADER = ["id", "name", "property_type", "city", "area", "lat", "lng", "price_low", "price_high",
          "lot_area_sqm", "floor_area_sqm", "rent_monthly", "turnover_status", "source", "as_of_date"]

OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(HEADER)
    for (i, n, t, c, a, lat, lng, lo, hi, lot, floor, rent, st) in PROPERTIES:
        w.writerow([i, n, t, c, a, lat, lng, float(lo), float(hi), float(lot),
                    "" if floor is None else float(floor),
                    "" if rent is None else float(rent), st, SOURCE, AS_OF])

print(f"Wrote {len(PROPERTIES)} properties to {OUT}")
