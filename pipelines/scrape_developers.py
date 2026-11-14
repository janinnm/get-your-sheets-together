"""Scrapes project pages from developer sites into one table of real projects.

Sources (project pages are listed in each site's sitemap and allowed by robots.txt):
  - mysmdc.ph             SMDC projects (a seller's site, not smdc.com). Prices are
                          marketing text, usually "from X / month", rarely a total.
  - dmcicondohomes.com    DMCI Homes. Publishes a total price range per project.
  - ayalalandpremier.com  Ayala Land Premier. No prices; status, sizes, and coordinates.

Writes:
  data/raw/developers/<date>.csv   snapshot of this run (keep every run: it is price history)
  data/processed/projects.csv      latest snapshot, read by export.py

Pages are cached in .cache/html/ for a day so re-runs don't hit the sites again.
Usage: python pipelines/scrape_developers.py [--refresh]
"""
import csv
import hashlib
import html
import json
import re
import sys
import time
from datetime import date, datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "html"
GEOCODE_CACHE = ROOT / "data" / "raw" / "geocode_cache.json"
SNAPSHOTS = ROOT / "data" / "raw" / "developers"
OUT = ROOT / "data" / "processed" / "projects.csv"

HEADERS = {"User-Agent": "get-your-sheets-together/0.1 (personal research project)"}
DELAY_S = 2.0  # pause between live requests
CACHE_MAX_AGE_S = 24 * 3600
TODAY = date.today()

FIELDS = [
    "id", "name", "developer", "property_type", "city", "address", "lat", "lng",
    "price_low", "price_high", "monthly_from", "price_text",
    "size_low_sqm", "size_high_sqm", "status", "turnover", "image_url",
    "source_url", "scraped_at",
]

# Metro Manila cities, matched against addresses. Order matters: "Pasay" before "Pasig" is irrelevant,
# but "Manila" must come last so "Metro Manila" in an address doesn't win over the real city.
NCR_CITIES = [
    ("Quezon City", r"quezon\s*city|\bq\.?\s*c\.?\b"), ("Makati", r"makati"), ("Taguig", r"taguig|\bbgc\b|bonifacio global"),
    ("Pasig", r"pasig|ortigas"), ("Mandaluyong", r"mandaluyong"), ("San Juan", r"san\s*juan"),
    ("Pasay", r"pasay|mall of asia|\bmoa\b"), ("Parañaque", r"para[nñ]aque"), ("Las Piñas", r"las\s*pi[nñ]as"),
    ("Muntinlupa", r"muntinlupa|alabang"), ("Marikina", r"marikina"), ("Caloocan", r"caloocan"),
    ("Valenzuela", r"valenzuela"), ("Malabon", r"malabon"), ("Navotas", r"navotas"), ("Pateros", r"pateros"),
    ("Manila", r"\bmanila\b(?!\s*bay)"),
]

refresh = "--refresh" in sys.argv
_last_request = 0.0


def fetch(url: str) -> str:
    """GET with a polite delay, cached on disk."""
    global _last_request
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".html")
    if not refresh and path.exists() and time.time() - path.stat().st_mtime < CACHE_MAX_AGE_S:
        return path.read_text(encoding="utf-8")
    wait = DELAY_S - (time.time() - _last_request)
    if wait > 0:
        time.sleep(wait)
    r = requests.get(url, headers=HEADERS, timeout=30)
    _last_request = time.time()
    r.raise_for_status()
    path.write_text(r.text, encoding="utf-8")
    return r.text


def sitemap_urls(url: str) -> list[str]:
    return re.findall(r"<loc>([^<]+)</loc>", fetch(url))


def text_lines(page: str) -> list[str]:
    """Visible text of a page, one non-empty line per block, invisible characters removed."""
    t = re.sub(r"(?s)<(script|style|noscript)[^>]*>.*?</\1>", " ", page)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t))
    t = re.sub(r"[​‌‍﻿]", "", t).replace("\xa0", " ")
    return [re.sub(r"\s+", " ", line).strip() for line in t.split("\n") if line.strip()]


LABELS = {"price", "price range", "location", "address", "project type", "turn-over date", "status",
          "description", "share it", "unit size range", "lot size", "type of property"}


def after(lines: list[str], label: str, exact_case: bool = False) -> str | None:
    """The line right after a label line, e.g. 'Price Range' -> 'Php5.7M - 13.4M'.
    Returns None when the field is empty (the next line is another label)."""
    for i, line in enumerate(lines[:-1]):
        key = line.rstrip(": ")
        if key == label if exact_case else key.lower() == label.lower():
            nxt = lines[i + 1].strip()
            if not nxt or nxt.rstrip(":").lower() in LABELS:
                return None
            return nxt
    return None


def meta(page: str, prop: str) -> str | None:
    m = re.search(rf'<meta[^>]+property="{prop}"[^>]+content="([^"]+)"', page)
    return html.unescape(m.group(1)) if m else None


def find_city(*texts: str | None) -> str | None:
    for t in texts:
        if not t:
            continue
        for city, pattern in NCR_CITIES:
            if re.search(pattern, t, re.I):
                return city
    return None


# ---------- number parsing ----------

def _amount(num: str, unit: str | None) -> float:
    n = float(num.replace(",", ""))
    unit = (unit or "").lower()
    if unit.startswith("b"):
        return n * 1e9
    if unit.startswith("m"):
        return n * 1e6
    if unit.startswith("k"):
        return n * 1e3
    return n


def price_range(text: str | None) -> tuple[float | None, float | None]:
    """'Php5.7M - 13.4M' / '900K -5.3M' / 'P 7.5M' -> (low, high) in pesos.
    A bare second number takes the first number's unit ('5.7M - 13.4' is 13.4M)."""
    if not text:
        return None, None
    text = re.sub(r"(\d)\.(?=\s*[mk]\b)", r"\1", text, flags=re.I)  # 'P5.1.M' -> 'P5.1M'
    nums = re.findall(r"(\d[\d,]*(?:\.\d+)?)\s*(m(?:illion)?|k|b(?:illion)?)?\b", text, re.I)[:2]
    # A bare number borrows its neighbour's unit: 'P5.4 - 7.9M' is 5.4M to 7.9M.
    units = [u for _, u in nums]
    for i, u in enumerate(units):
        if not u:
            units[i] = next((x for x in units[i + 1:] if x), None) or next((x for x in reversed(units[:i]) if x), None)
    vals = [round(_amount(n, u), -3) for (n, _), u in zip(nums, units)]
    vals = [v for v in vals if v >= 100_000]  # ignore stray small numbers
    if not vals:
        return None, None
    return min(vals), max(vals)


MONTHLY = r"\bmo\b|month"


def monthly_from(text: str | None) -> float | None:
    """'19,000+ / month' / 'Monthly starts at P24k+' -> 19000 / 24000."""
    if not text or not re.search(MONTHLY, text, re.I):
        return None
    m = re.search(r"(\d[\d,]*(?:\.\d+)?)\s*(k)?\+?\s*(?:/|per)?\s*(?:mo\b|month)", text, re.I) or re.search(
        r"month\w*\D{0,20}?(\d[\d,]*(?:\.\d+)?)\s*(k)?", text, re.I
    )
    if not m:
        return None
    v = _amount(m.group(1), m.group(2))
    return v if 1_000 <= v <= 1_000_000 else None


def sizes(text: str | None) -> tuple[float | None, float | None]:
    """'138sqm – 1,635sqm' -> (138, 1635)."""
    if not text:
        return None, None
    nums = [float(n.replace(",", "")) for n in re.findall(r"(\d[\d,]*(?:\.\d+)?)\s*sq", text, re.I)]
    return (min(nums), max(nums)) if nums else (None, None)


def status_from_turnover(text: str | None) -> str | None:
    """RFO / ready -> ready; a turnover date in the future -> preselling."""
    """Multi-building projects list several dates: any date still ahead means units are preselling."""
    if not text:
        return None
    if re.search(r"pre-?selling", text, re.I):
        return "preselling"
    years = [int(y) for y in re.findall(r"\b(20\d\d)\b", text)]
    years += [2000 + int(y) for y in re.findall(r"\b[a-z]{3}-(\d\d)\b", text, re.I)]  # 'Dec-25'
    dates = []
    for month, year in re.findall(r"\b([a-z]{3,9})\.?\s+(20\d\d)\b", text, re.I):
        try:
            dates.append(datetime.strptime(f"{month[:3].title()} {year}", "%b %Y").date())
        except ValueError:
            pass
    if any(d > TODAY for d in dates) or any(y > TODAY.year for y in years):
        return "preselling"
    if dates or years or re.search(r"\b(rfo|ready)\b", text, re.I):
        return "ready"
    return None


# ---------- geocoding (only for pages without coordinates) ----------

_geo_cache: dict = json.loads(GEOCODE_CACHE.read_text()) if GEOCODE_CACHE.exists() else {}


def _nominatim(endpoint: str, key: str, params: dict):
    """Cached Nominatim call. Nominatim's policy: max 1 request per second, identify yourself."""
    if key not in _geo_cache:
        time.sleep(1.1)
        r = requests.get(f"https://nominatim.openstreetmap.org/{endpoint}",
                         params={**params, "format": "json"}, headers=HEADERS, timeout=20)
        _geo_cache[key] = r.json() if r.ok else None
        GEOCODE_CACHE.parent.mkdir(parents=True, exist_ok=True)
        GEOCODE_CACHE.write_text(json.dumps(_geo_cache, indent=1, ensure_ascii=False))
    return _geo_cache[key]


def geocode(*queries: str | None) -> tuple[float, float] | None:
    """First hit for any of the queries (e.g. the street address, then the project name)."""
    for q in queries:
        if not q:
            continue
        hits = _nominatim("search", f"search:{q}", {"q": q, "limit": 1, "countrycodes": "ph"})
        if hits:
            return float(hits[0]["lat"]), float(hits[0]["lon"])
    return None


def ncr_city_at(lat: float, lng: float) -> str | None:
    """The Metro Manila city at a point, or None if the point is outside Metro Manila."""
    d = _nominatim("reverse", f"reverse:{lat:.5f},{lng:.5f}", {"lat": lat, "lon": lng, "zoom": 10})
    addr = (d or {}).get("address", {})
    if addr.get("region") != "Metro Manila":
        return None
    return find_city(addr.get("city"), addr.get("town"), addr.get("municipality"))


# ---------- sites ----------

def scrape_smdc() -> list[dict]:
    rows = []
    for url in sitemap_urls("https://mysmdc.ph/properties-sitemap.xml"):
        slug = url.rstrip("/").rsplit("/", 1)[-1]
        if slug == "properties":
            continue
        page = fetch(url)
        lines = text_lines(page)
        # The project's own taxonomy is on the single-post wrapper (listing cards repeat it for other projects).
        tax = re.search(r'elementor-location-single[^"]*', page)
        tax = tax.group(0) if tax else ""
        kind = re.search(r"property_categories-([\w-]+)", tax)
        status = re.search(r"property_classification-([\w-]+)", tax)
        location = re.search(r"property_location-([\w-]+)", tax)
        kind = kind.group(1) if kind else None
        price_text = after(lines, "Price")
        address = after(lines, "Location")
        # Most SMDC "prices" are monthly payments or move-in cash. Only read a total price
        # when the text is a plain amount or explicitly says cash / all-in / fixed price.
        is_total = price_text and (
            not re.search(rf"{MONTHLY}|move-in|spot|reserv", price_text, re.I)
            or re.search(r"cash|all-in|fixed price|total|tcp", price_text, re.I)
        )
        low, high = price_range(price_text) if is_total else (None, None)
        rows.append({
            "id": f"smdc-{slug}",
            "name": lines[lines.index("Price") - 1] if "Price" in lines else slug.replace("-", " ").title(),
            "developer": "SMDC",
            "property_type": {"condominium": "condo", "residential-offices": "condo", "house-and-lot": "house-and-lot"}.get(kind or ""),
            "city": find_city(address, location.group(1).replace("-", " ") if location else None),
            "address": address,
            "lat": None, "lng": None,
            "price_low": low, "price_high": high,
            "monthly_from": monthly_from(price_text),
            "price_text": price_text,
            "size_low_sqm": None, "size_high_sqm": None,
            "status": {"rfo": "ready", "pre-selling": "preselling"}.get(status.group(1) if status else ""),
            "turnover": None,
            "image_url": meta(page, "og:image"),
            "source_url": url,
        })
    return rows


def scrape_dmci() -> list[dict]:
    rows = []
    for url in sitemap_urls("https://www.dmcicondohomes.com/sitemap.xml"):
        page = fetch(url)
        lines = text_lines(page)
        price_text = after(lines, "Price Range")
        project_type = after(lines, "Project Type")
        if not price_text and not project_type:
            continue  # not a project page (guides, contact, news)
        slug = url.rsplit("/", 1)[-1].removesuffix(".html")
        title = meta(page, "og:title") or slug
        name = re.sub(r"\s*[-|]\s*DMCI.*$", "", title).strip()
        address = after(lines, "Address")
        turnover = after(lines, "Turn-over Date")
        ll = re.search(r"long=(-?[\d.]+)&(?:amp;)?lat=(-?[\d.]+)", page)
        low, high = price_range(price_text)
        # DMCI builds condos plus a few subdivisions (house and lot).
        kind = "house-and-lot" if "subdivision" in (project_type or "").lower() else "condo"
        rows.append({
            "id": f"dmci-{slug}",
            "name": name,
            "developer": "DMCI Homes",
            "property_type": kind,
            "city": find_city(address, name),
            "address": address,
            "lat": float(ll.group(2)) if ll else None,
            "lng": float(ll.group(1)) if ll else None,
            "price_low": low, "price_high": high,
            "monthly_from": None,
            "price_text": price_text,
            "size_low_sqm": None, "size_high_sqm": None,
            "status": status_from_turnover(turnover),
            "turnover": turnover,
            "image_url": meta(page, "og:image"),
            "source_url": url,
        })
    return rows


def scrape_alp() -> list[dict]:
    rows = []
    for url in sitemap_urls("https://www.ayalalandpremier.com/sitemap.xml"):
        if "/properties/" not in url:
            continue
        page = fetch(url)
        lines = text_lines(page)
        ptype = (after(lines, "Type of Property") or "").lower()
        status = (after(lines, "Status") or "").lower()
        size_text = after(lines, "Unit Size Range") or after(lines, "Lot Size")
        address = after(lines, "LOCATION", exact_case=True)
        ll = re.search(r"maps\?q=(-?[\d.]+),(-?[\d.]+)", page)
        slug = url.rsplit("/", 1)[-1]
        name_i = lines.index("Status") - 2 if "Status" in lines else None
        lo, hi = sizes(size_text)
        rows.append({
            "id": f"alp-{slug}",
            "name": lines[name_i].title() if name_i is not None else slug.replace("-", " ").title(),
            "developer": "Ayala Land Premier",
            "property_type": "condo" if "condo" in ptype else "lot" if "lot" in ptype and "house" not in ptype
            else "house-and-lot" if "house" in ptype else None,
            "city": find_city(address),
            "address": address,
            "lat": float(ll.group(1)) if ll else None,
            "lng": float(ll.group(2)) if ll else None,
            "price_low": None, "price_high": None,  # ALP does not publish prices
            "monthly_from": None,
            "price_text": None,
            "size_low_sqm": lo, "size_high_sqm": hi,
            "status": "ready" if "ready" in status else "preselling" if "pre" in status else None,
            "turnover": after(lines, "COMPLETION DATE"),
            "image_url": meta(page, "og:image"),
            "source_url": url,
        })
    return rows


def main():
    rows = []
    for name, scrape in (("SMDC", scrape_smdc), ("DMCI", scrape_dmci), ("Ayala Land Premier", scrape_alp)):
        got = scrape()
        print(f"{name}: {len(got)} projects")
        rows += got

    for r in rows:
        r["scraped_at"] = TODAY.isoformat()
        # Pages without coordinates: look up the street address, then the project name.
        # Only for projects whose text already places them in Metro Manila.
        if r["lat"] is None and r["city"]:
            hit = geocode(
                r["address"] and f"{r['address']}, Philippines",
                f"{r['name']}, {r['city']}, Philippines",
            )
            if hit:
                r["lat"], r["lng"] = hit
        # The city comes from the coordinates when we have them (addresses are often missing).
        if r["lat"] is not None:
            r["city"] = ncr_city_at(r["lat"], r["lng"])

    SNAPSHOTS.mkdir(parents=True, exist_ok=True)
    for path in (SNAPSHOTS / f"{TODAY.isoformat()}.csv", OUT):
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=FIELDS)
            w.writeheader()
            w.writerows(rows)
    ncr = [r for r in rows if r["city"]]
    print(f"Total {len(rows)}; in Metro Manila {len(ncr)}; with a total price {sum(1 for r in ncr if r['price_low'])}")
    print(f"Wrote {OUT.relative_to(ROOT)} and data/raw/developers/{TODAY.isoformat()}.csv")


if __name__ == "__main__":
    main()
