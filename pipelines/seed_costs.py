"""Writes placeholder NCR cost-of-living data to data/processed/costs.csv.
Replace with real pipelines (rent, utilities, fares, PSA) later."""
import csv
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "data" / "processed" / "costs.csv"
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

HEADER = ["city", "area", "category", "item", "value", "unit", "source", "source_url", "as_of_date"]

rows = []
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
        rows.append([city, a, cat, item, float(val), unit, SRC, URL, AS_OF])

OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(HEADER)
    w.writerows(rows)

print(f"Wrote {len(rows)} cost rows to {OUT}")
