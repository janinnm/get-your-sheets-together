# Get your sheets together

Helps people in Metro Manila decide where to live and what they can afford. It compares
condos, townhouses, houses, and lots against your income, savings, and risk appetite.

> Projects and prices are scraped from developer websites (SMDC, DMCI Homes, Ayala Land
> Premier). Where a developer doesn't publish a number, the app asks you for it instead of
> guessing. See [docs/sources.md](docs/sources.md).

## What it does

- **Properties**: a map of real Metro Manila projects with their published price ranges, with
  filters by type, status, and budget.
- **Offer check**: compares take-home pay and what's left over between two jobs.
- **Can I buy?**: loan payment, cash needed upfront, and an affordability verdict based on
  your risk profile. It also has a rate-rise stress test, a rent vs buy comparison, and a
  list of risks to weigh.

## Project layout

```
app/                    Next.js web app
  data/                 JSON the app reads (generated, don't edit by hand)
  src/
    app/                Next.js entry: layout and page
    components/
      Explorer.tsx      Map, side panel, and state shared across tabs
      ui.tsx            Shared styles and small UI pieces
      tabs/             One component per panel tab
    lib/                Pure logic, no React
      data.ts           Loads and validates the JSON
      listings.ts       One Listing shape for condos, houses, and lots
      payroll.ts        PH gross-to-net pay (SSS, PhilHealth, Pag-IBIG, tax)
      mortgage.ts       Loan math, rate shock, rent vs buy
      risk.ts           Risk profiles, property-type defaults, risk flags
      format.ts         Number formatting
    types/data.ts       Zod schemas for the JSON
data/processed/         Latest scraped CSV
data/raw/developers/    One snapshot per scrape (price history, keep these)
pipelines/              Scraper and exporter
docs/                   Data sources
```

## Running the app

```bash
cd app
npm install
npm run dev     # http://localhost:3000
```

## Updating the data

The pipelines need Python 3 and a virtual environment at the repo root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r pipelines/requirements.txt
```

Then, from `app/`:

```bash
npm run data:scrape   # scrapes the developer sites into data/processed/projects.csv (~10 min)
npm run data:export   # validates it and writes app/data/projects.json (Metro Manila only)
```

The scraper caches pages for a day; add `--refresh` to fetch fresh copies.

## Assumptions to review

Rates and rules change, so check these from time to time:

- `app/src/lib/payroll.ts`: contribution rates and tax brackets
- `app/src/lib/mortgage.ts`: closing costs and rent vs buy defaults
- `app/src/lib/risk.ts`: risk profiles and per-type loan defaults
