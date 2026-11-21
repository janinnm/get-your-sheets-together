"""Hazard levels at a point (flood, liquefaction) and the map layers that show them.

Usage: python pipelines/hazards.py   (writes the map layers; export.py does the per-project lookups)

Flood: UP Project NOAH's 100-year flood map of Metro Manila.
Source: Project NOAH hazard maps (ODbL; attribute Project NOAH and its contributors),
via the bettergovph mirror on Hugging Face, which repackages NOAH's shapefiles per province.
The 100-year map is the worst rainfall scenario NOAH models, so it's the cautious choice for
a purchase you'll hold for decades.

Levels (NOAH's `Var` attribute; depth and flow speed both count):
  low     up to 0.5 m
  medium  0.5 to 1.5 m
  high    over 1.5 m
  none    outside the mapped flood zones (not a guarantee it never floods)

The download (~25 MB) is cached in .cache/noah/.
"""
import io
import json
import math
import zipfile
from collections import Counter
from functools import cache
from pathlib import Path

import requests
import shapefile  # pyshp
from PIL import Image, ImageDraw
from shapely import Point, STRtree, box, make_valid, polygons, prepare, set_precision
from shapely.geometry import mapping, shape

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "noah" / "flood_100yr_metro_manila.zip"
URL = ("https://huggingface.co/datasets/bettergovph/project-noah-hazard-maps"
       "/resolve/main/Flood/100yr/Metro%20Manila.zip")
SHP = "MetroManila_Flood_100year"
LEVELS = {1: "low", 2: "medium", 3: "high"}


def _download() -> bytes:
    if not CACHE.exists():
        print("Downloading NOAH 100-year flood map for Metro Manila (~25 MB)...", flush=True)
        r = requests.get(URL, timeout=300)
        r.raise_for_status()
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_bytes(r.content)
    return CACHE.read_bytes()


@cache
def _read() -> tuple[list[tuple[int, list]], tuple[float, float, float, float]]:
    """Every ring in the file as (level, [(lng, lat), ...]), in file order, and the file's bbox.

    The file holds one huge multipolygon per level. Each outer edge is followed by its holes;
    outer edges run clockwise and holes counter-clockwise (the shapefile convention).
    """
    z = zipfile.ZipFile(io.BytesIO(_download()))
    r = shapefile.Reader(**{ext: io.BytesIO(z.read(f"{SHP}.{ext}")) for ext in ("shp", "shx", "dbf")})
    rings = []
    for sr in r.iterShapeRecords():
        pts, starts = sr.shape.points, list(sr.shape.parts) + [len(sr.shape.points)]
        for a, b in zip(starts, starts[1:]):
            if b - a >= 4:  # a closed ring needs 3 distinct points
                rings.append((int(sr.record["Var"]), pts[a:b]))
    return rings, tuple(r.bbox)


@cache
def _rings() -> tuple[STRtree, list[int]]:
    """A spatial index over every ring (outer edges and holes) and each ring's level.

    Rebuilding the multipolygons with holes matched to their outer edges takes over a minute,
    so rings are indexed as-is and flood_level uses the even-odd rule instead.
    """
    rings, _ = _read()
    return STRtree([polygons(pts) for _, pts in rings]), [lvl for lvl, _ in rings]


def flood_level(lat: float, lng: float) -> str:
    """The point is in a level's zone if it's inside an odd number of that level's rings
    (inside an outer edge but not inside one of its holes)."""
    tree, levels = _rings()
    inside = Counter(levels[i] for i in tree.query(Point(lng, lat), predicate="within"))
    hit = [lvl for lvl, n in inside.items() if n % 2]
    return LEVELS[max(hit)] if hit else "none"


# ---------- map overlay ----------

OVERLAY_PNG = ROOT / "app" / "public" / "flood-100yr.png"
OVERLAY_JSON = ROOT / "app" / "data" / "flood-overlay.json"
OVERLAY_WIDTH = 3000  # px; about 8 m per pixel across Metro Manila
# RGBA per level: light blue, amber, red, semi-transparent so streets show through.
COLORS = {1: (56, 189, 248, 110), 2: (250, 204, 21, 140), 3: (239, 68, 68, 160)}


def _merc_y(lat: float) -> float:
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def render_overlay():
    """Draws the flood zones into one transparent PNG laid over the map as an image layer.

    Rows are spaced in Web Mercator (the map's projection), so the image lines up with the
    streets when MapLibre stretches it between its four corners.
    """
    rings, (x0, y0, x1, y1) = _read()
    top, bottom = _merc_y(y1), _merc_y(y0)
    w = OVERLAY_WIDTH
    h = round(w * (top - bottom) / math.radians(x1 - x0))

    def px(pts):
        return [((x - x0) / (x1 - x0) * w, (top - _merc_y(y)) / (top - bottom) * h) for x, y in pts]

    def clockwise(pts) -> bool:
        return sum((bx - ax) * (by + ay) for (ax, ay), (bx, by) in zip(pts, pts[1:])) > 0

    level = Image.new("L", (w, h), 0)  # 0 = dry, else the highest level
    for lvl in sorted(COLORS):
        mask = Image.new("1", (w, h), 0)
        draw = ImageDraw.Draw(mask)
        # File order is outer edge then its holes, so painting in order carves holes correctly.
        for ring_lvl, pts in rings:
            if ring_lvl == lvl:
                draw.polygon(px(pts), fill=1 if clockwise(pts) else 0)
        level.paste(lvl, mask=mask)

    palette = [0, 0, 0, 0] + [c for lvl in sorted(COLORS) for c in COLORS[lvl]]
    out = Image.frombytes("P", (w, h), level.tobytes())  # pixel value = palette index = level
    out.putpalette(palette, rawmode="RGBA")
    OVERLAY_PNG.parent.mkdir(parents=True, exist_ok=True)
    out.save(OVERLAY_PNG, optimize=True)
    # MapLibre image source corners: top-left, top-right, bottom-right, bottom-left.
    OVERLAY_JSON.write_text(json.dumps({
        "url": "/" + OVERLAY_PNG.name,
        "coordinates": [[x0, y1], [x1, y1], [x1, y0], [x0, y0]],
    }, indent=2) + "\n")
    kb = OVERLAY_PNG.stat().st_size // 1024
    print(f"Wrote {OVERLAY_PNG.relative_to(ROOT)} ({w}x{h}, {kb} KB) and {OVERLAY_JSON.relative_to(ROOT)}")


# ---------- liquefaction (PHIVOLCS) ----------
#
# Source: PHIVOLCS liquefaction hazard map on GeoRiskPH (public ArcGIS service; "Acknowledge
# Philippine Institute of Volcanology and Seismology"). Metro Manila's zones come from the
# GMMA-READY project (mapped 2013) and use "potential" codes; the neighbouring provinces that
# fall inside the map's frame use "susceptible" codes. Both scales map onto low/moderate/high.

LIQ_URL = ("https://ulap-hazards.georisk.gov.ph/arcgis/rest/services/PHIVOLCSPublic"
           "/Liquefaction/MapServer/0/query")
LIQ_CACHE = ROOT / ".cache" / "phivolcs" / "liquefaction_metro_manila.geojson"
LIQ_OUT = ROOT / "app" / "public" / "liquefaction.geojson"
FRAME = (120.90, 14.35, 121.14, 14.79)  # Metro Manila, west/south/east/north
LIQ_LEVELS = {
    "02": "low", "03": "moderate", "04": "high",       # Metro Manila: low/moderate/high potential
    "05": "low", "06": "moderate", "07": "high",       # nearby provinces: least/moderately/highly susceptible
    "01": "moderate",                                  # generally susceptible
}


def _liquefaction_raw() -> dict:
    if not LIQ_CACHE.exists():
        print("Downloading PHIVOLCS liquefaction zones for Metro Manila...", flush=True)
        r = requests.get(LIQ_URL, timeout=300, params={
            "where": "1=1", "geometry": ",".join(map(str, FRAME)),
            "geometryType": "esriGeometryEnvelope", "inSR": 4326, "outSR": 4326,
            "spatialRel": "esriSpatialRelIntersects", "outFields": "lccode", "f": "geojson",
        })
        r.raise_for_status()
        LIQ_CACHE.parent.mkdir(parents=True, exist_ok=True)
        LIQ_CACHE.write_text(r.text)
    return json.loads(LIQ_CACHE.read_text())


@cache
def _liquefaction_zones() -> list[tuple[str, object]]:
    """(level, polygon) clipped to Metro Manila's frame and simplified to about 10 m."""
    frame = box(*FRAME)
    zones = []
    for f in _liquefaction_raw()["features"]:
        level = LIQ_LEVELS.get(f["properties"]["lccode"])
        geom = make_valid(shape(f["geometry"])).intersection(frame)
        geom = set_precision(geom.simplify(0.0001, preserve_topology=True), 0.00001)
        if level and not geom.is_empty:
            prepare(geom)
            zones.append((level, geom))
    return zones


def liquefaction_level(lat: float, lng: float) -> str:
    """low / moderate / high, or none outside the mapped zones."""
    p = Point(lng, lat)
    hits = {level for level, geom in _liquefaction_zones() if geom.contains(p)}
    return next((lvl for lvl in ("high", "moderate", "low") if lvl in hits), "none")


def write_liquefaction():
    """The zones as GeoJSON for the map's Liquefaction toggle (loaded only when switched on)."""
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "properties": {"level": level}, "geometry": mapping(geom)}
        for level, geom in _liquefaction_zones()
    ]}
    LIQ_OUT.parent.mkdir(parents=True, exist_ok=True)
    LIQ_OUT.write_text(json.dumps(fc, separators=(",", ":")))
    print(f"Wrote {LIQ_OUT.relative_to(ROOT)} ({LIQ_OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    render_overlay()
    write_liquefaction()
