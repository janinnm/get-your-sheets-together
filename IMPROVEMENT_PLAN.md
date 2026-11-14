# Get your sheets together: Improvement Plan

> This file sums up planning discussions about turning the app into a profitable product.
> It is written so that a reader (human or LLM) with no prior context can review it, critique it,
> and help carry it out. Last updated: 2026-11-14.

---

## 1. Current state (as of this plan)

**What the app is:** a map-based tool for deciding where to live in Metro Manila. Three tabs:

- **Condos:** pins with estimated price (30 sqm), 1BR rent, gross rental yield, source/date, licensed photo. Filters: All / Ready / Preselling, Under ₱5M. The list follows the map viewport.
- **Cost of living:** monthly cost for one person per city (Rent, Utilities, Transport, Food). Rent can be switched between 1BR condo and Bedspace. Assumes 150 kWh electricity.
- **Offer check:** compares current job/city with an offer. Works out PH deductions (SSS, PhilHealth, Pag-IBIG, TRAIN-law income tax) and shows a +₱ / −₱ monthly difference.

**Tech:**
- Next.js 16, React 19, Tailwind 4, MapLibre + react-map-gl, OpenFreeMap tiles
- No backend. JSON data is bundled and all calculations run in the browser
- Data flow: `pipelines/*.py → data/processed/*.csv → pipelines/export.py (pandera) → app/data/*.json (zod) → app`

**Data:** all prices and costs are **placeholders**. 13 real condo names (geocoded via Nominatim, photos from Wikimedia Commons) with **placeholder prices**, 8 cities with condos, 80 cost rows across 10 cities.

**Known issues:**
1. Preselling filter always shows nothing (all 13 condos are "ready").
2. Muntinlupa and Las Piñas have cost data but no condos, so the map doesn't move when they're clicked.
3. `seed_placeholder.py` and `enrich_condos.py` both write `condos.csv`. Running the seed script deletes the real names and photos, and `export.py` then fails its checks.
4. `enrich_condos.py` and `export.py` must be run from the repo root.
5. No `requirements.txt` (requests, pandas, pandera).
6. `app/src/app/types/data.ts` is an old, unused copy of the data types (missing the photo fields).
7. `zod` is only listed in the root `package.json`, not in `app/package.json`.
8. Hard-coded assumptions: 30 sqm unit, ₱5M budget, 150 kWh/month. Payroll rates need review whenever they change.
9. Real building names are shown with made-up prices, which is a credibility and partnership risk.

---

## 2. Goal and business model

**Goal:** make the app profitable.

**Core idea:** the app reaches two groups at the moment they're about to spend money:
- **People relocating for a job** (Offer check)
- **Condo investors** (rental yield)

**Who pays:** businesses (developers, brokers) and investors, **not** casual users. The free tools exist to bring in traffic and leads.

**Legal note:** under the Real Estate Service Act (RA 9646), commissions on property sales generally require a licensed broker. Charge partners **per lead or a flat advertising fee** rather than a sales commission, or partner with a licensed broker. Confirm with a broker or lawyer before taking money.

---

## 3. Priority features (in order)

### #1: Inquiry button on preselling condos (main revenue)
- **Revenue:** pay-per-lead or advertising fees from developers and brokers.
- **Minimum version:**
  - Real data for 5–10 preselling projects in one area (Makati, BGC or Pasig)
  - "Inquire / book a site visit" button collecting name, contact, budget, timeline, and cash or loan
  - Backend stores the inquiry and emails or webhooks it to the partner
- **Proof it works:** about 30–50 real inquiries per month, then pitch to developers or brokers.

### #2: Net-yield and cash-flow calculator (investor premium tier)
- **Revenue:** subscription (₱199–499/month) or one-time reports.
- Gross yield stays free. Net yield and cash flow are paid.
- Net yield must subtract: **association dues, real property tax, vacancy months, management fees**.
- Cash flow: down payment, monthly loan payment, dues, rent, and net cash per month.
- Payments through PayMongo (GCash and cards).
- ⚠️ **Open question:** a net-yield calculator may already exist in the code. Check what it subtracts. If it's complete, #2 is mostly the cash-flow view plus the paywall.

### #3: Offer check as its own page that brings traffic
- No direct revenue. It brings free users who then see the map.
- Standalone page (for example "Philippines take-home pay calculator").
- Shareable result image ("+₱12,400/month if I take this offer").
- Result links to "Condos near your new office within budget," which feeds #1.

### #4: Guest features and a business portal (decision: no required consumer accounts)
**Decision:** people search for housing rarely, so **consumer accounts are not required**. Accounts are only for businesses.

| Need | No-account version |
|---|---|
| Saved condos and settings | Browser storage (localStorage) |
| Inquiries | The inquiry form asks for contact details each time |
| Price alerts | Email subscription with a confirmation email and an unsubscribe link |
| Premium tier | Pay through PayMongo, then get access by email (magic link or code) |
| Rent submissions | Anonymous, with email confirmation to cut spam |

**Business portal** (build only **after the first partner says yes**; email leads to them until then):
- Lead dashboard (status: new, contacted, viewing booked; export)
- Listing management (partners update their own prices and availability, which keeps your verified data current)
- Analytics (views, saves, inquiries per project)
- Billing
- Auth for business users only (email and password or Google sign-in; roles such as `developer_admin` and `agent`)

### Wait until there's revenue
- Cost-of-living extras (household profiles, editable electricity usage)
- Bedspace listings
- Filling in more cities
- Selling Offer check to HR teams and recruiters
- Mortgage and moving referrals
- Sponsored map pins

---

## 4. Data sourcing strategy

**Decision: don't rely on web scraping as the main data source.**

Why:
- Listing sites (Lamudi, Property24, Dot Property) generally prohibit scraping in their terms and compete for the same developers we want as partners.
- Listings contain personal data (agent names, phones), which falls under the Data Privacy Act (RA 10173).
- Scraped prices are **asking prices**, often duplicated, stale or fake.
- Scrapers break when sites change, which is a recurring cost for a two-person team.

**Sources to use:**

| Data | Source |
|---|---|
| Preselling prices | Developers' price lists and sales agents (they want to share them) |
| Rents | Anonymous submissions from users |
| Area-level estimates | Quarterly market reports (Colliers, Leechiu, Santos Knight Frank, JLL), BSP residential property price index |
| Cost of living | PSA, Meralco and water utility rates, LTFRB fares |
| Ready condos / resale | Partner brokers' listings, sent with permission |

**Precedence when merging, for each condo:** verified price → user submissions → area estimate → placeholder.

Scraping, if done at all, is only an internal check, never shown as our data, never stores personal details, and only from sites whose terms allow it.

---

## 5. Data pipeline fixes

### 5.1 One script per file
```
data/
  sources/        # hand-entered or collected data (real prices go here)
    condo_prices.csv
    preselling_projects.csv
  interim/        # one file per script, never edited by hand
    condos_placeholder.csv    ← seed_placeholder.py
    condos_enriched.csv       ← enrich_condos.py (names, coordinates, photos)
  processed/      # written ONLY by the merge step
    condos.csv
  cache/
    geocode.json
```
Rule: **each file has exactly one script that writes it.**

### 5.2 Stable IDs and a merge step
- Add `condo_id` (slug, for example `the-rise-makati`) to every condo row.
- New `pipelines/build_condos.py`: start from enriched data, left-join sources on `condo_id`, fill gaps from placeholders, set an `is_placeholder` flag, and write `processed/condos.csv`.
- The app shows a **"Verified price"** badge or an **"Estimate"** badge based on `is_placeholder`.

### 5.3 Run from any folder
```python
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
```

### 5.4 Cache geocoding and photo lookups
Save Nominatim results to `data/cache/geocode.json` (Nominatim allows about 1 request per second) and only look up condos that aren't cached yet. Do the same for Wikimedia lookups.

### 5.5 Stricter validation (one shared pandera schema module)
- `condo_id` is unique; `status` is either `ready` or `preselling`
- If `is_placeholder` is false, then `source` and `as_of` are required
- Price per sqm and rent fall within realistic Metro Manila ranges
- Gross yield is between about 2% and 12%
- Warn if `as_of` is more than 6 months old

### 5.6 Cleanup
- Add `requirements.txt` with pinned versions
- Move `zod` into `app/package.json`
- Delete the unused `app/src/app/types/data.ts`
- Keep payroll rates in data files with an "updated on" date, not hard-coded

### 5.7 One command and CI
```json
"data": "python pipelines/enrich_condos.py && python pipelines/build_condos.py && python pipelines/export.py"
```
Keep `seed:placeholder` separate (it now only writes its own interim file). Optionally add a GitHub Action that runs `npm run data` on every pull request.

**Order:** paths and requirements → split outputs, merge and `condo_id` → validation → cache, one command and CI.

---

## 6. Backend (to be built)

A small Ktor or Spring Boot service with Postgres/PostGIS:
- Endpoint that stores inquiries and notifies partners by email or webhook (with user consent); rate-limited
- Email alert subscriptions (confirmation email, unsubscribe)
- Anonymous rent submissions with moderation and outlier filtering
- PayMongo or Xendit integration for the premium tier, with access by magic link
- Business auth, roles and portal (later, after the first partner)
- Later: serve map data from the backend instead of static JSON

The Python pipelines keep producing static JSON for the free map.

---

## 7. Roadmap

| Week(s) | Work |
|---|---|
| 1–2 | Fix the data pipeline; real prices for one area including 5–10 preselling projects; remove placeholder prices on real building names |
| 2–3 | Backend: inquiry endpoint and notifications, email alerts, Postgres |
| 3–4 | Inquiry button live; Offer check landing page and share card |
| 5–6 | Net-yield and cash-flow calculator, payment and premium tier |
| After | Pitch 2–3 developers or brokers with inquiry numbers; build the business portal once a partner signs |

**Who does what:** front end and data by one person, backend (Ktor/Spring Boot, Postgres, PayMongo) by the other.

---

## 8. Open questions

- [ ] Does a net-yield calculator already exist? What does it subtract?
- [ ] Which area to make real first: Makati, BGC or Pasig?
- [ ] Partner with a licensed broker, or charge flat per-lead or advertising fees?
- [ ] Ktor or Spring Boot for the backend?
- [ ] What to give users in return for rent submissions?

## 9. Reminder 
- Feature creation still in progress do not forget to scan first for changes
