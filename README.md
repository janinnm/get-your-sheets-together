# Get your sheets together

Helps people in Metro Manila decide where to live and what they can afford. It compares
condos, townhouses, houses, and lots against your income, savings, and risk appetite.

> All prices and costs are **placeholder estimates**, not real market data yet.

## What it does

- **Properties**: a map of condos, townhouses, house and lots, and vacant lots, with filters.
- **Living costs**: monthly rent, utilities, transport, and food per city.
- **Offer check**: compares take-home pay and what's left over between two jobs or cities.
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
      cost-of-living.ts Monthly costs per city
      payroll.ts        PH gross-to-net pay (SSS, PhilHealth, Pag-IBIG, tax)
      mortgage.ts       Loan math, rate shock, rent vs buy
      risk.ts           Risk profiles, property-type defaults, risk flags
      format.ts         Number formatting
    types/data.ts       Zod schemas for the JSON
data/processed/         CSVs produced by the pipelines
pipelines/              Python scripts that build and export the data
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
npm run data:seed     # placeholder costs.csv and properties.csv
npm run data:condos   # condos.csv: geocodes names and finds photos (needs internet)
npm run data:export   # validates the CSVs and writes app/data/*.json
```

Run `data:export` after changing any CSV in `data/processed/`.

## Assumptions to review

Rates and rules change, so check these from time to time:

- `app/src/lib/payroll.ts`: contribution rates and tax brackets
- `app/src/lib/mortgage.ts`: closing costs and rent vs buy defaults
- `app/src/lib/risk.ts`: risk profiles and per-type loan defaults
