# Data sources

Every number shown in the app comes from one of these sources, or is something the user types in.

## Projects (`pipelines/scrape_developers.py`)

| Source | What we take | What it doesn't have |
|---|---|---|
| [mysmdc.ph](https://mysmdc.ph/) (SMDC projects) | Name, type, status (RFO / preselling), address, advertised price text, photo | Coordinates. Most "prices" are a starting monthly payment or move-in cash, not a total price. This is a seller's site, not SMDC's official smdc.com. |
| [dmcicondohomes.com](https://www.dmcicondohomes.com/) (DMCI Homes) | Name, type, published total price range, turnover date, address, coordinates, photo | Unit sizes, prices per unit |
| [ayalalandpremier.com](https://www.ayalalandpremier.com/properties) (Ayala Land Premier) | Name, type, status, unit or lot size range, coordinates, completion date, photo | Prices (not published) |

How the scraper works:

- It finds project pages through each site's sitemap. All three sites' robots.txt allow those pages.
- It waits 2 seconds between requests and caches pages in `.cache/html/` for a day.
- It keeps the price **exactly as written** in `price_text`, next to the parsed `price_low`, `price_high`, and `monthly_from`, so every parsed number can be checked against the source.
- A total price is read from SMDC text only when it says cash, all-in, or fixed price. Monthly and move-in amounts are never treated as totals.
- Coordinates come from the page when available. Otherwise it looks up the street address, then the project name, with [OpenStreetMap Nominatim](https://nominatim.org/) at 1 request per second, cached in `data/raw/geocode_cache.json`.
- The city comes from the coordinates (Nominatim reverse lookup). Only projects inside Metro Manila are exported to the app.
- Photos link to the developer's own site and remain theirs.

Each run writes a dated snapshot to `data/raw/developers/<date>.csv`. **Keep these.** Over time they become the price history that predictions will need.

## Payroll (`app/src/lib/payroll.ts`)

SSS, PhilHealth, and Pag-IBIG contribution rules and the TRAIN law income tax brackets.

## Assumptions (editable in the app, not data)

Interest rate, down payment, loan term, condo dues per sqm, upkeep rate, price growth, closing costs (~6%), and selling costs (~10%) are general rules of thumb set in `app/src/lib/risk.ts` and `app/src/lib/mortgage.ts`. Users can change them on the "Can I buy?" tab.

## Not yet sourced

There is no real data yet for rents or for living costs (utilities, transport, food), so the app asks the user for these instead. Candidates: PSA price surveys, Meralco and Maynilad published rates, and rental listings.
