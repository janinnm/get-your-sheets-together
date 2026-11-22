import { useState, type ReactNode } from "react";
import { grossToNet } from "../../lib/payroll";
import {
  assess,
  maxAffordablePrice,
  rateShock,
  DEFAULT_CLOSING_COST_RATE,
  type LoanTerms,
} from "../../lib/mortgage";
import { PROFILE_ALTERNATIVE } from "../../lib/alternatives";
import { KIND_LABEL, type Listing } from "../../lib/listings";
import {
  KIND_DEFAULTS,
  PROFILES,
  finalVerdict,
  monthlyUpkeep,
  riskFlags,
  type Profile,
} from "../../lib/risk";
import { NumberFields, chip, label, note, type NumberInput } from "../ui";
import PropertyPicker from "./buy/PropertyPicker";
import VerdictSummary from "./buy/VerdictSummary";
import RiskFlags from "./buy/RiskFlags";
import RateShock from "./buy/RateShock";
import RentVsBuy from "./buy/RentVsBuy";

const BASE_RATE = 6.5; // % per year, typical home-loan rate

/** Condo dues are charged per sqm, so we need a unit size. Studios start around here. */
const DEFAULT_CONDO_SQM = 30;

function defaultsFor(l: Listing) {
  const d = KIND_DEFAULTS[l.kind];
  return {
    price: l.priceLow ?? 0,
    sqm: l.sizeLow ?? DEFAULT_CONDO_SQM,
    dp: d.downPaymentPct,
    years: d.years,
    rate: BASE_RATE + d.rateBumpPct,
    dues: l.kind === "condo" ? d.duesPerSqm : d.duesFlat,
    appr: d.appreciationPct,
  };
}

/** "Can I buy?": affordability, risks, rate rises, and rent vs buy for one listing. */
export default function BuyTab({
  listings,
  listingId,
  onPick,
}: {
  listings: Listing[];
  listingId: string;
  onPick: (id: string) => void;
}) {
  const listing = listings.find((l) => l.id === listingId) ?? listings[0];
  const init = defaultsFor(listing);

  // About you
  const [profile, setProfile] = useState<Profile>("balanced");
  const [gross, setGross] = useState(80_000);
  const [savings, setSavings] = useState(1_500_000);
  const [living, setLiving] = useState(20_000);
  const [rent, setRent] = useState(15_000);

  // Loan and property (reset to type defaults when the listing changes)
  const [price, setPrice] = useState(init.price);
  const [sqm, setSqm] = useState(init.sqm);
  const [dp, setDp] = useState(init.dp);
  const [rate, setRate] = useState(init.rate);
  const [years, setYears] = useState(init.years);
  const [dues, setDues] = useState(init.dues);
  const [fixedYears, setFixedYears] = useState(5);

  // Reset type-specific inputs when a different listing is picked
  // (React's "adjust state when a prop changes" pattern).
  const [prevId, setPrevId] = useState(listing.id);
  if (prevId !== listing.id) {
    const d = defaultsFor(listing);
    setPrevId(listing.id);
    setPrice(d.price);
    setSqm(d.sqm);
    setDp(d.dp);
    setRate(d.rate);
    setYears(d.years);
    setDues(d.dues);
  }

  const kind = KIND_DEFAULTS[listing.kind];
  const rules = PROFILES[profile];
  const isCondo = listing.kind === "condo";

  // ---------- math ----------
  const pay = grossToNet(gross);
  // Buying a home replaces your rent; buying a lot doesn't, so you keep paying it.
  const livingCosts = living + (kind.housesYou ? 0 : rent);
  const other =
    (isCondo ? dues * sqm : dues) + monthlyUpkeep(listing.kind, price);
  const terms: LoanTerms = {
    price,
    downPaymentPct: dp / 100,
    annualRate: rate / 100,
    years,
  };
  const budget = {
    grossMonthly: gross,
    netMonthly: pay.net,
    livingCosts,
    otherOwnershipCosts: other,
    maxDti: rules.maxDti,
  };

  const r = assess({
    terms,
    ...budget,
    buffers: rules.buffers,
    savings,
    emergencyMonths: rules.emergencyMonths,
  });
  const maxPrice = maxAffordablePrice(gross, terms, rules.maxDti);
  const shock = rateShock({ terms, fixedYears, ...budget });
  const flags = riskFlags({
    listing,
    profile,
    result: r,
    shockRows: shock.rows,
    fixedYears,
    loanYears: years,
  });
  const verdict = finalVerdict(r.verdict, flags);

  // ---------- inputs ----------
  const youInputs: NumberInput[] = [
    {
      label: "Gross monthly salary (₱)",
      value: gross,
      onChange: setGross,
      step: 1000,
    },
    {
      label: "Savings you can use (₱)",
      value: savings,
      onChange: setSavings,
      step: 50_000,
    },
    {
      label: "Living costs, excl. rent (₱/mo)",
      value: living,
      onChange: setLiving,
      step: 1000,
    },
    {
      label: "Your rent now (₱/mo)",
      value: rent,
      onChange: setRent,
      step: 1000,
    },
  ];

  const loanInputs: NumberInput[] = [
    {
      label: "Price (₱)",
      value: price,
      onChange: setPrice,
      step: 100_000,
    },
    ...(isCondo
      ? [{ label: "Unit size (sqm)", value: sqm, onChange: setSqm }]
      : []),
    {
      label: "Down payment (%)",
      value: dp,
      onChange: (v) => setDp(Math.min(100, v)),
      step: 5,
      max: 100,
    },
    {
      label: "Interest rate (% / yr)",
      value: rate,
      onChange: setRate,
      step: 0.25,
    },
    {
      label: `Loan term (max ${kind.maxYears} yrs)`,
      value: years,
      onChange: (v) => setYears(Math.max(1, Math.min(kind.maxYears, v))),
      max: kind.maxYears,
    },
    {
      label: isCondo ? "Assoc. dues (₱/sqm/mo)" : "HOA dues (₱/mo)",
      value: dues,
      onChange: setDues,
      step: isCondo ? 10 : 100,
    },
  ];

  return (
    <>
      {/* Risk appetite */}
      <p className={`mb-1 ${label}`}>Your risk appetite</p>
      <div className="mb-1 flex flex-wrap gap-2">
        {(Object.keys(PROFILES) as Profile[]).map((p) => (
          <button
            key={p}
            onClick={() => setProfile(p)}
            className={chip(profile === p)}
          >
            {PROFILES[p].label}
          </button>
        ))}
      </div>
      <p className={`mb-4 ${note}`}>
        {rules.blurb} Loan payment up to {Math.round(rules.maxDti * 100)}% of
        gross, {rules.emergencyMonths}-month emergency fund, must survive a +
        {rules.mustSurviveShockPct} point rate rise.
      </p>

      <PropertyPicker listings={listings} listing={listing} onPick={onPick} />

      <p className={`mb-1 ${label}`}>About you</p>
      <NumberFields fields={youInputs} />
      <p className={`mb-1 mt-4 ${label}`}>The property and loan</p>
      <NumberFields fields={loanInputs} />

      {price <= 0 ? (
        <p className="mt-4 rounded-2xl border-2 border-[#1B1340] bg-[#FFF3C4] p-4 text-sm font-semibold">
          {listing.developer} doesn&apos;t publish a price for {listing.name}.
          Enter a price from a quote to see if you can afford it.
        </p>
      ) : (
        <>
          <VerdictSummary
            verdict={verdict}
            r={r}
            price={price}
            maxPrice={maxPrice}
            years={years}
            takeHome={pay.net}
            livingCosts={livingCosts}
            livingLabel={kind.housesYou ? "Living costs" : "Living + rent"}
            otherCosts={other}
            kindLabel={KIND_LABEL[listing.kind]}
          />

          {flags.length > 0 && (
            <Section title="🧭 Risks to weigh">
              <RiskFlags flags={flags} />
            </Section>
          )}

          <Section title="⚡ What if rates go up?">
            <RateShock
              shock={shock}
              fixedYears={fixedYears}
              setFixedYears={setFixedYears}
              loanYears={years}
              mustSurviveShockPct={rules.mustSurviveShockPct}
              maxDti={rules.maxDti}
            />
          </Section>
        </>
      )}

      <Section title="🏠 Buy, or rent and invest?">
        {kind.housesYou ? (
          <RentVsBuy
            listingId={listing.id}
            terms={terms}
            otherCosts={other}
            fixedYears={fixedYears}
            onPriceChange={setPrice}
            defaultAppreciationPct={init.appr}
            profileAlternative={PROFILE_ALTERNATIVE[profile]}
          />
        ) : (
          <p className="text-sm font-semibold">
            A lot doesn&apos;t replace your rent, so this doesn&apos;t apply.
          </p>
        )}
      </Section>

      {price > 0 && (
        <p className={`mt-4 ${note}`}>
          Rough estimates for a first look, not a bank quote. Closing costs are
          about {Math.round(DEFAULT_CLOSING_COST_RATE * 100)}% of the price.
          Upkeep includes about 0.25%/yr real property tax
          {listing.kind === "house-and-lot" || listing.kind === "townhouse"
            ? " plus maintenance"
            : ""}
          . Selling costs in the buy vs rent comparison are about 10% (6%
          capital gains tax plus broker fees). Prices are as published on{" "}
          {listing.developer}&apos;s site on {listing.scrapedAt}.
        </p>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <h3 className="mt-6 text-lg font-extrabold">{title}</h3>
      {children}
    </>
  );
}
