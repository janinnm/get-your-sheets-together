# Get your sheets together: Improvement Plan

> This file sums up planning discussions about where to take the app next.
> It is written so that a reader (human or LLM) with no prior context can review it, critique it,
> and help carry it out. Last updated: 2026-11-22.

---

## 1. Current state (as of this plan)

**What the app is:** a map-based tool that helps people in Metro Manila decide what property they can
afford to buy (a condo, townhouse, house and lot, or lot), based on their income, savings, and risk
appetite. Two tabs:

- **Properties:** a map of real Metro Manila projects from developer websites, with published price
  ranges or advertised monthly payments, status (ready or preselling), and photos. Filters by property
  type, status, and budget. The list follows the map viewport.
- **Can I buy?:** for a chosen property, the loan payment, cash needed upfront (down payment and
  closing costs), monthly ownership costs (dues, tax, upkeep), and an affordability verdict that
  depends on a risk profile (conservative, balanced, aggressive). It also has a rate-rise stress test,
  a rent vs buy comparison, and a list of risks to weigh. Where a developer doesn't publish a number,
  the app asks the user for it instead of guessing.

**Tech:**
- Next.js 16, React 19, Tailwind 4, MapLibre + react-map-gl, OpenFreeMap tiles
- No backend. JSON data is bundled and all calculations run in the browser
- Data flow (each file has exactly one writer):
  ```
  scrape_developers.py → data/interim/projects_scraped.csv
  you, by hand         → data/sources/project_overrides.csv
  build_projects.py    → data/processed/projects.csv   (pandera)
  export.py            → app/data/projects.json        (pandera, then zod in the app)
  ```
  `npm run data` runs it all; `npm run data:rebuild` re-merges hand-entered data without scraping.

**Data:**
- 168 projects scraped from SMDC (mysmdc.ph), DMCI Homes, and Ayala Land Premier; 110 are in Metro
  Manila and reach the app, across 11 cities.
- Every project has a `price_source`: `verified` (entered by hand from a developer price list),
  `scraped` (an asking price from the developer's site) or `none`. Today: 0 verified, 121 scraped,
  47 none.
- No placeholder data remains. There is **no rent data and no cost-of-living data**; the app asks the
  user for rent and living costs.
- Sources are documented in `docs/sources.md`.

**Known issues:**
1. **No rent data**, so there is no rental yield anywhere in the app. Feature #2 below depends on it.
2. 47 projects have no usable price: Ayala Land Premier publishes none, and many SMDC pages give only
   move-in cash or a monthly payment.
3. SMDC fixed or promo prices ("3M all-in") are stored with `price_low` equal to `price_high`, which
   reads as an exact price when it is a marketing figure. `price_text` keeps the original wording.
4. Two Metro Manila projects have no map pin and are skipped by the export:
   `smdc-breeze-residences`, `smdc-ice-tower-residential-offices`. Fix by adding lat/lng in
   `data/sources/project_overrides.csv`.
5. `smdc-gold-residences` and `smdc-gold-residential-offices` have a Parañaque address but were
   geocoded to Pasay, and share the same coordinates (possibly the same project listed twice).
6. 4 exported projects have an unknown status (neither ready nor preselling).
7. `alp-soliento` has the label text "TURNOVER DATE" as its address. The scraper is fixed; the data
   corrects itself on the next scrape. It is outside Metro Manila, so the app never showed it.
8. The app doesn't show `price_source` yet (no "Verified price" badge).
9. Rates and rules live in code and need review whenever they change: `app/src/lib/payroll.ts`
   (contributions, tax brackets), `mortgage.ts` (closing costs, rent vs buy defaults), `risk.ts`
   (risk profiles, per-type loan defaults).

---

## 2. Purpose and goal

**Purpose:** help someone in Metro Manila answer "what property can I actually afford, and should I
buy it?" with real projects and real prices, their own numbers, and an honest view of the risks.

**Who it's for:**
- **First-time buyers** checking what fits their income, savings, and risk appetite
- **People deciding between renting and buying** (rent vs buy, rate-rise stress test)

**Principles:**
- Real data or none: show a published price with its source and date, or ask the user. Never invent
  a number.
- The user's own situation (income, savings, risk profile) drives every verdict.

**Making money (longer term):** the ideas in Section 3 (inquiries to developers, a premium investor
tier) were written when the plan treated lead generation as the goal. They are kept for reference but
need review against the purpose above; see Section 8.

**Legal note (applies to any developer or broker deal):** under the Real Estate Service Act (RA 9646),
commissions on property sales generally require a licensed broker. Charge partners **per lead or a
flat advertising fee** rather than a sales commission, or partner with a licensed broker. Confirm with
a broker or lawyer before taking money.

---

## 3. Priority features (in order)

> Written when lead generation was the goal. Needs review against Section 2 (see Section 8).

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
- **Checked:** no yield calculator exists. `app/src/lib/mortgage.ts` has affordability, a rate-rise
  stress test and rent vs buy; ownership costs are one combined input, not broken into dues, tax,
  vacancy and management. **Blocked on data:** the pipeline has no rent data, so a rent source is
  needed before any yield can be shown.

### #3: Guest features and a business portal (decision: no required consumer accounts)
**Decision:** people search for housing rarely, so **consumer accounts are not required**. Accounts are only for businesses.

| Need | No-account version |
|---|---|
| Saved properties and settings | Browser storage (localStorage) |
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
- Rent and living-cost data sources (see Section 4)
- Bedspace listings
- More developers and cities outside Metro Manila
- Mortgage and moving referrals
- Sponsored map pins

---

## 4. Data sourcing strategy

**Decision: don't rely on scraping listing sites.**

Why:
- Listing sites (Lamudi, Property24, Dot Property) generally prohibit scraping in their terms and compete for the same developers we want as partners.
- Listings contain personal data (agent names, phones), which falls under the Data Privacy Act (RA 10173).
- Scraped prices are **asking prices**, often duplicated, stale or fake.
- Scrapers break when sites change, which is a recurring cost for a two-person team.

**Current practice:** project data is scraped from **developers' own sites**, only pages their
robots.txt allows, with no personal data stored (see `docs/sources.md`). These are asking prices and
are marked `price_source=scraped`.

**Sources to use:**

| Data | Source |
|---|---|
| Preselling prices | Developers' price lists and sales agents (they want to share them), entered in `data/sources/project_overrides.csv` |
| Rents | Anonymous submissions from users |
| Area-level estimates | Quarterly market reports (Colliers, Leechiu, Santos Knight Frank, JLL), BSP residential property price index |
| Cost of living | PSA, Meralco and water utility rates, LTFRB fares |
| Ready condos / resale | Partner brokers' listings, sent with permission |

**Precedence when merging, for each project:** verified price → user submissions → area estimate →
scraped asking price. Today only verified and scraped exist, and `build_projects.py` applies that order.

---

## 5. Data pipeline

### Done (PR #4)
- **One writer per file:** the scraper writes `data/interim/`, hand-entered data lives in
  `data/sources/project_overrides.csv`, and only `pipelines/build_projects.py` writes
  `data/processed/`. A scrape no longer overwrites hand-entered data.
- **Stable IDs and a merge step:** every project has an `id` (e.g. `dmci-sage-residences`).
  `build_projects.py` merges overrides on `id` and sets `price_source` (`verified` / `scraped` /
  `none`), `price_as_of`, and `price_note`. A three-value field replaced the planned boolean
  `is_placeholder`, since there are no placeholders left.
- **Run from any folder:** all paths come from `pipelines/schema.py`.
- **Caching:** geocoding is cached in `data/raw/geocode_cache.json`, pages in `.cache/html/` for a day.
- **Shared validation (`pipelines/schema.py`):** unique ids, known status and type, price and monthly
  bounds, `price_low ≤ price_high`, `price_source` consistent with the price columns, Metro Manila
  bounds on export. The build stops on a mistyped override id, a non-number, or a verified price with
  no date, and warns when a verified price is over 6 months old.
- **Loud, not silent:** pins outside the Philippines are cleared and reported; the export lists every
  skipped project and why.
- **One command:** `npm run data` (scrape, build, export) and `npm run data:rebuild` (build, export).
  The scraper shows progress bars for each site and for geocoding.
- `requirements.txt` with version ranges; `zod` is in `app/package.json`; no duplicate type files.

### Still to do
- A rent data source (blocks #2), and a `price_source` badge in the app (Known issue 8).
- A GitHub Action that runs `npm run data:rebuild` on every pull request.
- Move payroll rates into data files with an "updated on" date instead of code.

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
| 1–2 | ~~Fix the data pipeline~~ (done, PR #4); verified prices for one area including 5–10 preselling projects; `price_source` badge in the app |
| 2–3 | Backend: inquiry endpoint and notifications, email alerts, Postgres |
| 3–4 | Inquiry button live |
| 5–6 | Net-yield and cash-flow calculator, payment and premium tier (needs a rent data source first) |
| After | Pitch 2–3 developers or brokers with inquiry numbers; build the business portal once a partner signs |

**Who does what:** front end and data by one person, backend (Ktor/Spring Boot, Postgres, PayMongo) by the other.

---

## 8. Open questions

- [x] Does a net-yield calculator already exist? **No** (see #2). Yield also needs rent data, which we don't have.
- [ ] Do the priorities in Section 3 still fit the purpose in Section 2, or should buyer-facing features come first?
- [ ] Where will rent data come from: user submissions, a market report, or partner brokers?
- [ ] Which area to verify prices for first: Makati, BGC or Pasig?
- [ ] Partner with a licensed broker, or charge flat per-lead or advertising fees?
- [ ] Ktor or Spring Boot for the backend?
- [ ] What to give users in return for rent submissions?

## 9. Reminder
- Feature creation still in progress do not forget to scan first for changes
