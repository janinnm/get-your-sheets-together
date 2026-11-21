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
data/
  sources/              Hand-entered data: verified prices and corrections (edit these)
  interim/              Latest scrape (generated, don't edit by hand)
  processed/            Scrape + your sources merged (generated, don't edit by hand)
  raw/developers/       One snapshot per scrape (price history, keep these)
pipelines/
  scrape_developers.py  Developer sites -> data/interim/
  build_projects.py     data/interim/ + data/sources/ -> data/processed/
  export.py             data/processed/ -> app/data/ (Metro Manila only)
  schema.py             Paths and validation rules shared by all three
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
npm run data           # everything: scrape (~10 min), then rebuild
npm run data:rebuild   # merge data/sources/ and re-export, without scraping
```

Each file has exactly one writer, so a scrape never overwrites what you entered by hand:

```
scrape_developers.py  ->  data/interim/projects_scraped.csv
you                   ->  data/sources/project_overrides.csv
build_projects.py     ->  data/processed/projects.csv
export.py             ->  app/data/projects.json
```

**Adding a verified price or fixing a project:** add a row to
`data/sources/project_overrides.csv` (instructions are at the top of the file), then run
`npm run data:rebuild`. Every project gets a `price_source` of `verified` (a price you
entered from a developer price list), `scraped` (an asking price from the developer's
site), or `none`. The build stops with a message on a mistyped id, a non-number price,
an inverted price range, or a verified price without a date, and warns when a verified
price is over six months old.

The scraper caches pages for a day; add `--refresh` to fetch fresh copies.

## Assumptions to review

Rates and rules change, so check these from time to time:

- `app/src/lib/payroll.ts`: contribution rates and tax brackets
- `app/src/lib/mortgage.ts`: closing costs and rent vs buy defaults
- `app/src/lib/risk.ts`: risk profiles and per-type loan defaults
