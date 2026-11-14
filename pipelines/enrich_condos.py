"""Builds data/processed/condos.csv from real NCR project names.
Geocodes with Nominatim and finds a licensed photo on Wikimedia Commons.
Prices are PLACEHOLDER area estimates, not real prices for these projects."""
import csv
import re
import time
from pathlib import Path

import requests

OUT = Path(__file__).resolve().parents[1] / "data" / "processed" / "condos.csv"
HEADERS = {"User-Agent": "ph-cost-of-living/0.1 (personal project; contact: you@example.com)"}  # use your email
AS_OF = "2026-11-01"
SOURCE = "PLACEHOLDER: area estimate, not this project's real price"
NCR_BBOX = (14.35, 14.80, 120.90, 121.20)  # lat min, lat max, lng min, lng max
OK_LICENSES = ("CC BY", "CC0", "Public domain")

# id, name, city, area, fallback lat, fallback lng, price/sqm low, high, 1BR rent, status
PROJECTS = [
    ("mkt-001", "Proscenium at Rockwell",        "Makati",      "Rockwell",        14.5640, 121.0360, 260000, 340000, 38000, "ready"),
    ("mkt-002", "The Residences at Greenbelt",   "Makati",      "Legazpi Village", 14.5530, 121.0200, 250000, 320000, 35000, "ready"),
    ("mkt-003", "Park Terraces",                 "Makati",      "Ayala Center",    14.5510, 121.0250, 240000, 310000, 34000, "ready"),
    ("tag-001", "Uptown Parksuites",             "Taguig",      "BGC",             14.5560, 121.0560, 280000, 380000, 40000, "ready"),
    ("tag-002", "Grand Hyatt Manila Residences", "Taguig",      "BGC",             14.5510, 121.0460, 300000, 400000, 45000, "ready"),
    ("tag-003", "Venice Luxury Residences",      "Taguig",      "McKinley Hill",   14.5350, 121.0500, 200000, 260000, 34000, "ready"),
    ("pas-001", "The Grove by Rockwell",         "Pasig",       "Ugong",           14.5690, 121.0690, 170000, 230000, 28000, "ready"),
    ("man-001", "One Shangri-La Place",          "Mandaluyong", "Ortigas Center",  14.5817, 121.0560, 200000, 270000, 32000, "ready"),
    ("qc-001",  "Eastwood Le Grand",             "Quezon City", "Eastwood",        14.6100, 121.0800, 150000, 200000, 25000, "ready"),
    ("qc-002",  "Avida Towers Vertis North",     "Quezon City", "Vertis North",    14.6560, 121.0310, 130000, 180000, 23000, "ready"),
    ("mnl-001", "Torre de Manila",               "Manila",      "Ermita",          14.5810, 120.9830, 100000, 150000, 20000, "ready"),
    ("psy-001", "Shell Residences",              "Pasay",       "MOA Complex",     14.5350, 120.9800, 160000, 220000, 27000, "ready"),
    ("par-001", "Solemare Parksuites",           "Parañaque",   "Aseana",          14.5240, 120.9890, 140000, 190000, 23000, "ready"),
]

def geocode(name, city):
    r = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={"q": f"{name}, {city}, Philippines", "format": "json", "limit": 1, "countrycodes": "ph"},
        headers=HEADERS, timeout=20,
    )
    time.sleep(1.1)  # Nominatim allows 1 request per second
    data = r.json() if r.ok else []
    if data:
        lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
        if NCR_BBOX[0] <= lat <= NCR_BBOX[1] and NCR_BBOX[2] <= lng <= NCR_BBOX[3]:
            return lat, lng
    return None

def commons_image(name, city):
    r = requests.get(
        "https://commons.wikimedia.org/w/api.php",
        params={
            "action": "query", "format": "json", "generator": "search",
            "gsrsearch": f"{name} {city}", "gsrnamespace": 6, "gsrlimit": 8,
            "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 800,
        },
        headers=HEADERS, timeout=20,
    )
    pages = r.json().get("query", {}).get("pages", {}) if r.ok else {}
    for p in sorted(pages.values(), key=lambda p: p.get("index", 99)):
        info = (p.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = meta.get("LicenseShortName", {}).get("value", "")
        url = info.get("thumburl") or info.get("url", "")
        if not url.lower().endswith((".jpg", ".jpeg", ".png")):
            continue
        if not lic.startswith(OK_LICENSES) or "NC" in lic or "ND" in lic:
            continue
        artist = re.sub(r"<[^>]+>", "", meta.get("Artist", {}).get("value", "")).strip()
        return url, artist or "Unknown", lic, info.get("descriptionurl", "")
    return None

header = ["id", "name", "developer", "city", "area", "lat", "lng", "price_per_sqm_low",
          "price_per_sqm_high", "rent_1br_monthly", "turnover_status", "source", "as_of_date",
          "image_url", "image_credit", "image_license", "image_page"]

rows = []
for pid, name, city, area, flat, flng, lo, hi, rent, status in PROJECTS:
    geo = geocode(name, city)
    lat, lng = geo if geo else (flat, flng)
    img = commons_image(name, city)
    iurl, icredit, ilic, ipage = img if img else ("", "", "", "")
    print(f"{name:32} coords={'geocoded' if geo else 'FALLBACK'}  photo={'yes' if img else 'NONE'}")
    if img:
        print(f"    {ipage}")
    rows.append([pid, name, "", city, area, lat, lng, float(lo), float(hi), float(rent), status,
                 SOURCE, AS_OF, iurl, icredit, ilic, ipage])
    time.sleep(0.5)

OUT.parent.mkdir(parents=True, exist_ok=True)
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(header)
    w.writerows(rows)
print(f"\nWrote {len(rows)} condos to {OUT}")