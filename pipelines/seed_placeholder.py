"""Writes placeholder NCR data to data/processed/. Replace with real pipelines later."""
import csv
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "processed"
AS_OF = "2026-11-01"
SRC, URL = "PLACEHOLDER", "https://example.com/placeholder"

KWH_RATE = 12.0     # same utility for all NCR (Meralco), placeholder
INTERNET = 1699.0

# city: (area, 1BR rent, bedspace rent, water/month, commute/month, meal, groceries/month)
NCR = {
    "Makati":        ("CBD",        32000, 6000, 420, 4000, 280, 8500),
    "Taguig":        ("BGC",        38000, 7000, 400, 4200, 300, 8800),
    "Pasig":         ("Ortigas",    28000, 5500, 380, 4000, 260, 8200),
    "Mandaluyong":   ("Shaw",       27000, 5500, 380, 3800, 250, 8000),
    "Quezon City":   ("Cubao",      22000, 4500, 360, 3800, 220, 7500),
    "Manila":        ("Ermita",     20000, 4000, 380, 3500, 200, 7200),
    "Pasay":         ("MOA",        24000, 5000, 380, 3800, 230, 7600),
    "Parañaque":     ("Aseana",     21000, 4500, 360, 3800, 220, 7400),
    "Muntinlupa":    ("Alabang",    25000, 5000, 360, 4000, 240, 7800),
    "Las Piñas":     ("Almanza",    18000, 4000, 340, 3600, 200, 7200),
}

# id, name, city, area, lat, lng, price/sqm low, high, 1BR rent, status  (coordinates are approximate)
CONDOS = [
    ("mkt-001", "Placeholder Tower A",     "Makati",      "CBD",         14.5547, 121.0244, 250000, 320000, 35000, "ready"),
    ("mkt-002", "Placeholder Lofts B",     "Makati",      "Poblacion",   14.5650, 121.0300, 230000, 300000, 32000, "ready"),
    ("tag-001", "Placeholder Suites C",    "Taguig",      "BGC",         14.5507, 121.0450, 280000, 380000, 40000, "ready"),
    ("tag-002", "Placeholder Hill D",      "Taguig",      "McKinley",    14.5360, 121.0510, 200000, 260000, 34000, "preselling"),
    ("pas-001", "Placeholder Central E",   "Pasig",       "Ortigas",     14.5866, 121.0614, 170000, 230000, 28000, "preselling"),
    ("pas-002", "Placeholder Corner F",    "Pasig",       "Kapitolyo",   14.5740, 121.0640, 150000, 200000, 26000, "ready"),
    ("man-001", "Placeholder Plaza G",     "Mandaluyong", "Shaw",        14.5810, 121.0530, 160000, 210000, 27000, "ready"),
    ("qc-001",  "Placeholder Cubao H",     "Quezon City", "Cubao",       14.6200, 121.0530, 120000, 170000, 22000, "ready"),
    ("qc-002",  "Placeholder Eastside I",  "Quezon City", "Eastwood",    14.6100, 121.0790, 150000, 200000, 25000, "ready"),
    ("qc-003",  "Placeholder Morato J",    "Quezon City", "Tomas Morato",14.6330, 121.0340, 140000, 190000, 24000, "preselling"),
    ("mnl-001", "Placeholder Bay K",       "Manila",      "Ermita",      14.5800, 120.9850, 100000, 150000, 20000, "ready"),
    ("psy-001", "Placeholder Arena L",     "Pasay",       "MOA",         14.5350, 120.9830, 160000, 220000, 27000, "preselling"),
    ("par-001", "Placeholder Shore M",     "Parañaque",   "Aseana",      14.5210, 120.9900, 140000, 190000, 23000, "ready"),
    ("mun-001", "Placeholder Residences N","Muntinlupa",  "Alabang",     14.4200, 121.0400, 140000, 190000, 24000, "preselling"),
    ("lpn-001", "Placeholder Gardens O",   "Las Piñas",   "Almanza",     14.4130, 120.9990,  90000, 130000, 18000, "ready"),
]

def write(name, header, rows):
    OUT.mkdir(parents=True, exist_ok=True)
    with open(OUT / name, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)

costs = []
for city, (area, rent1, rentb, water, commute, meal, groceries) in NCR.items():
    for a, cat, item, val, unit in [
        (area, "rent", "1BR condo", rent1, "PHP/month"),
        (area, "rent", "Bedspace", rentb, "PHP/month"),
        ("Citywide", "utilities", "Electricity", KWH_RATE, "PHP/kWh"),
        ("Citywide", "utilities", "Water", water, "PHP/month"),
        ("Citywide", "utilities", "Internet", INTERNET, "PHP/month"),
        ("Citywide", "transport", "Monthly commute", commute, "PHP/month"),
        ("Citywide", "food", "Inexpensive meal", meal, "PHP/meal"),
        ("Citywide", "food", "Groceries", groceries, "PHP/month"),
    ]:
        costs.append([city, a, cat, item, float(val), unit, SRC, URL, AS_OF])

write("costs.csv",
      ["city", "area", "category", "item", "value", "unit", "source", "source_url", "as_of_date"], costs)

write("condos.csv",
      ["id", "name", "developer", "city", "area", "lat", "lng", "price_per_sqm_low",
       "price_per_sqm_high", "rent_1br_monthly", "turnover_status", "source", "as_of_date"],
      [[i, n, "Placeholder Dev", c, a, lat, lng, float(lo), float(hi), float(r), st, SRC, AS_OF]
       for i, n, c, a, lat, lng, lo, hi, r, st in CONDOS])

print(f"Wrote {len(costs)} cost rows and {len(CONDOS)} condos to {OUT}/")