import { useState } from "react";
import { peso, short } from "../../lib/format";
import { grossToNet } from "../../lib/payroll";
import {
  assess,
  maxAffordablePrice,
  rateShock,
  rentVsBuy,
  DEFAULT_CLOSING_COST_RATE,
  DEFAULT_RENT_VS_BUY,
  type Verdict,
} from "../../lib/mortgage";
import {
  KINDS,
  KIND_EMOJI,
  KIND_LABEL,
  type Listing,
} from "../../lib/listings";
import {
  KIND_DEFAULTS,
  PROFILES,
  finalVerdict,
  monthlyUpkeep,
  riskFlags,
  type Flag,
  type Profile,
} from "../../lib/risk";
import {
  NumberFields,
  Row,
  chip,
  field,
  label,
  note,
  resultCard,
  type NumberInput,
} from "../ui";

const BASE_RATE = 6.5; // % per year, typical home-loan rate

const VERDICT: Record<Verdict, { label: string; bg: string; note: string }> = {
  comfortable: {
    label: "Comfortable",
    bg: "#BEF264",
    note: "You qualify and keep a healthy buffer for your risk profile.",
  },
  tight: {
    label: "Tight",
    bg: "#FDE047",
    note: "You qualify, but there's little room for surprises.",
  },
  stretch: {
    label: "Stretch",
    bg: "#FFB84D",
    note: "A lender may say no, your monthly buffer is thin, or your savings run low after paying upfront.",
  },
  "not-yet": {
    label: "Not yet",
    bg: "#FF8FA3",
    note: "Monthly costs would exceed your take-home, or your savings don't cover the upfront cash.",
  },
};

const FLAG_STYLE: Record<Flag["level"], { bg: string; icon: string }> = {
  high: { bg: "#FFE3EA", icon: "🚩" },
  medium: { bg: "#FFF3C4", icon: "⚠️" },
  info: { bg: "#FFFFFF", icon: "💡" },
};

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

export default function BuyCheck({
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

  // Rent vs buy
  const [horizon, setHorizon] = useState(DEFAULT_RENT_VS_BUY.horizonYears);
  const [apprPct, setApprPct] = useState(init.appr);
  const [rentGrowthPct, setRentGrowthPct] = useState(
    DEFAULT_RENT_VS_BUY.rentGrowth * 100,
  );
  const [investPct, setInvestPct] = useState(
    DEFAULT_RENT_VS_BUY.investReturn * 100,
  );

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
    setApprPct(d.appr);
  }

  const kind = KIND_DEFAULTS[listing.kind];
  const rules = PROFILES[profile];
  const isCondo = listing.kind === "condo";

  // ---------- math ----------
  const pay = grossToNet(gross);
  // Buying a home replaces your rent; buying a lot doesn't, so you keep paying it.
  const livingCosts = living + (kind.housesYou ? 0 : rent);
  const duesTotal = isCondo ? dues * sqm : dues;
  const upkeep = monthlyUpkeep(listing.kind, price);
  const other = duesTotal + upkeep;
  const terms = {
    downPaymentPct: dp / 100,
    annualRate: rate / 100,
    years,
  };

  const r = assess({
    terms: { ...terms, price },
    grossMonthly: gross,
    netMonthly: pay.net,
    livingCosts,
    otherOwnershipCosts: other,
    maxDti: rules.maxDti,
    buffers: rules.buffers,
    savings,
    emergencyMonths: rules.emergencyMonths,
  });
  const maxPrice = maxAffordablePrice(gross, terms, rules.maxDti);

  const shock = rateShock({
    terms: { ...terms, price },
    fixedYears,
    grossMonthly: gross,
    netMonthly: pay.net,
    livingCosts,
    otherOwnershipCosts: other,
    maxDti: rules.maxDti,
  });

  const flags = riskFlags({
    listing,
    profile,
    result: r,
    shockRows: shock.rows,
    fixedYears,
    loanYears: years,
  });
  const verdict = finalVerdict(r.verdict, flags);

  const rvb = kind.housesYou
    ? rentVsBuy({
        terms: { ...terms, price },
        monthlyRent: rent,
        otherOwnershipCosts: other,
        assumptions: {
          horizonYears: horizon,
          appreciation: apprPct / 100,
          rentGrowth: rentGrowthPct / 100,
          investReturn: investPct / 100,
        },
      })
    : null;
  const rvbLast = rvb?.years[rvb.years.length - 1];

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

  const rentVsBuyInputs: NumberInput[] = [
    {
      label: "Years to compare",
      value: horizon,
      onChange: (v) => setHorizon(Math.max(1, Math.min(30, v))),
      max: 30,
    },
    {
      label: "Price growth (%/yr)",
      value: apprPct,
      onChange: setApprPct,
      step: 0.5,
    },
    {
      label: "Rent increase (%/yr)",
      value: rentGrowthPct,
      onChange: setRentGrowthPct,
      step: 0.5,
    },
    {
      label: "Investment return (%/yr)",
      value: investPct,
      onChange: setInvestPct,
      step: 0.5,
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

      {/* Property */}
      <label className={label}>
        Property
        <select
          value={listing.id}
          onChange={(e) => onPick(e.target.value)}
          className={`${field} mb-1 mt-0.5 text-[#1B1340]`}
        >
          {KINDS.map((k) => {
            const group = listings.filter((l) => l.kind === k);
            return group.length ? (
              <optgroup key={k} label={KIND_LABEL[k]}>
                {group.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.city}
                    {l.priceLow ? `, from ${short(l.priceLow)}` : ""})
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      <p className={`mb-3 ${note}`}>
        {KIND_EMOJI[listing.kind]} {KIND_LABEL[listing.kind]} by{" "}
        {listing.developer} in {listing.city}
        {listing.status === "preselling" ? " · Preselling" : ""}
        <br />
        Published price:{" "}
        {listing.priceLow
          ? priceRange(listing)
          : listing.monthlyFrom
            ? `not listed (ads say from ${peso(listing.monthlyFrom)}/mo)`
            : "not listed"}
        .{" "}
        <a
          href={listing.url}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Project page
        </a>
      </p>

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
        results()
      )}
    </>
  );

  // A render helper, not a component: a nested component would remount (and drop input focus) on every render.
  function results() {
    return (
      <>
        {/* Verdict */}
        <div className={`mt-4 ${resultCard}`} aria-live="polite">
          <span
            className="inline-block rounded-full border-2 border-white px-3 py-0.5 text-sm font-extrabold text-[#1B1340]"
            style={{ background: VERDICT[verdict].bg }}
          >
            {VERDICT[verdict].label}
          </span>
          <div className="mt-3 text-4xl font-black">
            {peso(r.monthlyPayment)}
            <span className="text-sm font-semibold text-white/60">
              {" "}
              /mo amortization
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold">
            {verdict !== r.verdict
              ? "The numbers work, but there's a 🚩 risk below that's a deal-breaker for your risk appetite."
              : VERDICT[verdict].note}
          </p>
          <p className="mt-2 text-xs text-white/60">
            For a price of {peso(price)}.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
          <div className="rounded-2xl border-2 border-[#1B1340] bg-white p-3">
            <p className="mb-1 text-sm font-extrabold">Cash upfront</p>
            <Row label="Down payment" value={peso(r.downPayment)} />
            <Row
              label="Closing costs"
              value={peso(r.upfrontCash - r.downPayment)}
            />
            <Row label="Total" value={peso(r.upfrontCash)} total />
            <Row
              label="Savings left"
              value={peso(r.savingsAfter ?? 0)}
              warn={(r.savingsAfter ?? 0) < r.emergencyTarget}
            />
          </div>
          <div className="rounded-2xl border-2 border-[#1B1340] bg-white p-3">
            <p className="mb-1 text-sm font-extrabold">Each month</p>
            <Row label="Take-home" value={peso(pay.net)} />
            <Row
              label={kind.housesYou ? "Living costs" : "Living + rent"}
              value={`−${peso(livingCosts)}`}
            />
            <Row label="Loan" value={`−${peso(r.monthlyPayment)}`} />
            <Row label="Dues, tax, upkeep" value={`−${peso(other)}`} />
            <Row
              label="Left over"
              value={peso(r.leftover)}
              total
              warn={r.leftover < 0}
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border-2 border-[#1B1340] bg-[#FFF3C4] p-3 text-sm font-semibold">
          <Row
            label="Minimum gross income for this loan"
            value={peso(r.requiredGross)}
            warn={!r.qualifies}
            bold
          />
          <Row
            label={`Max ${KIND_LABEL[listing.kind].toLowerCase()} price you qualify for`}
            value={short(maxPrice)}
            bold
          />
          <Row
            label="Emergency fund to keep"
            value={peso(r.emergencyTarget)}
            bold
          />
          <Row
            label={`Total interest over ${years} yrs`}
            value={peso(r.totalInterest)}
            bold
          />
        </div>

        {/* Risk flags */}
        {flags.length > 0 && (
          <>
            <h3 className="mt-6 text-lg font-extrabold">🧭 Risks to weigh</h3>
            <ul className="mt-2 space-y-2">
              {flags.map((f, i) => (
                <li
                  key={i}
                  className="flex gap-2 rounded-xl border-2 border-[#1B1340] p-3 text-sm font-semibold"
                  style={{ background: FLAG_STYLE[f.level].bg }}
                >
                  <span aria-hidden>{FLAG_STYLE[f.level].icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Rate shock */}
        <h3 className="mt-6 text-lg font-extrabold">⚡ What if rates go up?</h3>
        <p className={`mb-2 ${label}`}>
          Bank rates are usually fixed for a few years, then reprice to the
          market rate on the balance left.
        </p>
        <p className={label}>Fixed period (years)</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {[1, 3, 5, 10].map((y) => (
            <button
              key={y}
              onClick={() => setFixedYears(y)}
              className={chip(fixedYears === y)}
              disabled={y > years}
            >
              {y} yr{y > 1 ? "s" : ""}
            </button>
          ))}
        </div>
        {shock.yearsLeft > 0 ? (
          <div className="overflow-x-auto rounded-2xl border-2 border-[#1B1340] bg-white">
            <table className="w-full text-xs font-semibold">
              <thead className="bg-[#FFF3C4] text-left">
                <tr>
                  <th className="p-2">New rate</th>
                  <th className="p-2 text-right">Payment</th>
                  <th className="p-2 text-right">Change</th>
                  <th className="p-2 text-right">Left over</th>
                </tr>
              </thead>
              <tbody>
                {shock.rows.map((s) => (
                  <tr
                    key={s.shockPct}
                    className={`border-t-2 border-[#1B1340]/10 ${s.shockPct === rules.mustSurviveShockPct ? "bg-[#F6F3FF]" : ""}`}
                  >
                    <td className="p-2">
                      {(s.newRate * 100).toFixed(2)}%{" "}
                      <span className="text-[#1B1340]/50">(+{s.shockPct})</span>
                    </td>
                    <td className="p-2 text-right">{peso(s.newPayment)}</td>
                    <td className="p-2 text-right">+{peso(s.increase)}</td>
                    <td
                      className={`p-2 text-right font-extrabold ${s.leftover < 0 ? "text-[#D6336C]" : ""}`}
                    >
                      {peso(s.leftover)}
                      {!s.qualifies && " ⚠️"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm font-semibold">
            The rate is fixed for the whole loan, so there&apos;s no reset.
          </p>
        )}
        {shock.yearsLeft > 0 && (
          <p className={`mt-2 ${note}`}>
            At year {Math.min(fixedYears, years)} you&apos;d still owe{" "}
            {peso(shock.balanceAtReset)} over {shock.yearsLeft} years. The
            highlighted row is the rise your profile should survive. ⚠️ means
            the payment is above {Math.round(rules.maxDti * 100)}% of
            today&apos;s gross income.
          </p>
        )}

        {/* Rent vs buy */}
        <h3 className="mt-6 text-lg font-extrabold">🏠 Rent or buy?</h3>
        {rvb && rvbLast ? (
          <>
            <p className={`mb-2 ${label}`}>
              Compares your net worth after {horizon} years. The renter invests
              the upfront cash instead, and whoever pays less each month invests
              the difference.
            </p>
            <NumberFields fields={rentVsBuyInputs} />
            <div
              className="mt-4 rounded-2xl border-2 border-[#1B1340] p-4 shadow-[3px_3px_0_0_#1B1340]"
              style={{ background: rvb.advantage >= 0 ? "#BEF264" : "#DDF3FF" }}
              aria-live="polite"
            >
              <p className="text-2xl font-black">
                {rvb.advantage >= 0 ? "Buying" : "Renting"} wins by{" "}
                {peso(Math.abs(rvb.advantage))}
              </p>
              <p className="mt-1 text-sm font-semibold">
                {rvb.breakEvenYear
                  ? `Buying pulls ahead in year ${rvb.breakEvenYear}.`
                  : `Buying doesn't pull ahead within ${horizon} years.`}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold">
                <div className="rounded-lg border-2 border-[#1B1340] bg-white p-2">
                  Buyer net worth
                  <b className="block text-base">
                    {peso(rvbLast.buyerNetWorth)}
                  </b>
                </div>
                <div className="rounded-lg border-2 border-[#1B1340] bg-white p-2">
                  Renter net worth
                  <b className="block text-base">
                    {peso(rvbLast.renterNetWorth)}
                  </b>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm font-semibold">
            A lot doesn&apos;t replace your rent, so this comparison
            doesn&apos;t apply. Your rent is already counted in your monthly
            costs above.
          </p>
        )}

        <p className={`mt-4 ${note}`}>
          Rough estimates for a first look, not a bank quote. Closing costs are
          about {Math.round(DEFAULT_CLOSING_COST_RATE * 100)}% of the price.
          Upkeep includes about 0.25%/yr real property tax
          {listing.kind === "house-and-lot" || listing.kind === "townhouse"
            ? " plus maintenance"
            : ""}
          . Selling costs in the rent vs buy comparison are about 10% (6%
          capital gains tax plus broker fees). Prices are as published on{" "}
          {listing.developer}&apos;s site on {listing.scrapedAt}.
        </p>
      </>
    );
  }
}

function priceRange(l: Listing) {
  if (!l.priceLow) return "";
  return l.priceHigh && l.priceHigh > l.priceLow
    ? `${peso(l.priceLow)} to ${peso(l.priceHigh)}`
    : `from ${peso(l.priceLow)}`;
}
