import { useState } from "react";
import { compact, pct, peso } from "../../../lib/format";
import {
  DEFAULT_RENT_VS_BUY,
  similarRent,
  type LoanTerms,
} from "../../../lib/mortgage";
import {
  ALTERNATIVES,
  ALTERNATIVE_IDS,
  isVolatile,
  rentVsBuyReason,
  rentVsBuyScenarios,
  type AlternativeId,
  type ReturnRange,
} from "../../../lib/alternatives";
import {
  NumberFields,
  Row,
  chip,
  label,
  note,
  type NumberInput,
} from "../../ui";

/** "Buy, or rent and invest?": compares net worth after N years either way. */
export default function RentVsBuy({
  listingId,
  terms,
  otherCosts,
  fixedYears,
  onPriceChange,
  defaultAppreciationPct,
  profileAlternative,
}: {
  listingId: string;
  terms: LoanTerms;
  otherCosts: number;
  fixedYears: number;
  /** Lets the user type a price here when the developer doesn't publish one. */
  onPriceChange: (price: number) => void;
  defaultAppreciationPct: number;
  /** The investment that suits the chosen risk profile. */
  profileAlternative: AlternativeId;
}) {
  const [horizon, setHorizon] = useState(DEFAULT_RENT_VS_BUY.horizonYears);
  const [apprPct, setApprPct] = useState(defaultAppreciationPct);
  const [rentGrowthPct, setRentGrowthPct] = useState(
    DEFAULT_RENT_VS_BUY.rentGrowth * 100,
  );
  const [alt, setAlt] = useState<AlternativeId | "custom">(profileAlternative);
  const [investPct, setInvestPct] = useState(
    DEFAULT_RENT_VS_BUY.investReturn * 100,
  );
  // Rent for a place like this one; follows the price until the user types one.
  const [compRentInput, setCompRentInput] = useState<number | null>(null);

  // Follow the risk profile and listing when they change
  // (React's "adjust state when a prop changes" pattern).
  const [prevProfileAlt, setPrevProfileAlt] = useState(profileAlternative);
  if (prevProfileAlt !== profileAlternative) {
    setPrevProfileAlt(profileAlternative);
    setAlt(profileAlternative);
  }
  const [prevId, setPrevId] = useState(listingId);
  if (prevId !== listingId) {
    setPrevId(listingId);
    setApprPct(defaultAppreciationPct);
    setCompRentInput(null);
  }

  const { price, annualRate, years } = terms;
  const altInfo = alt === "custom" ? null : ALTERNATIVES[alt];
  const altReturns: ReturnRange = altInfo
    ? altInfo.returns
    : {
        low: investPct / 100,
        expected: investPct / 100,
        high: investPct / 100,
      };
  const compRent = compRentInput ?? similarRent(price);
  const scenarios = rentVsBuyScenarios(
    {
      terms,
      monthlyRent: compRent,
      otherOwnershipCosts: otherCosts,
      assumptions: {
        horizonYears: horizon,
        appreciation: apprPct / 100,
        rentGrowth: rentGrowthPct / 100,
      },
    },
    altReturns,
  );
  const investLabel = altInfo?.label ?? "Your investment";
  const rvb = scenarios.expected;
  const rvbLast = rvb.years[rvb.years.length - 1];

  const assumptionInputs: NumberInput[] = [
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
  ];

  const rentInputs: NumberInput[] = [
    {
      label: "Rent for a similar place (₱/mo)",
      value: compRent,
      onChange: setCompRentInput,
      step: 1000,
    },
    ...(alt === "custom"
      ? [
          {
            label: "Your return (%/yr, after tax)",
            value: investPct,
            onChange: setInvestPct,
            step: 0.5,
          },
        ]
      : []),
  ];

  if (price <= 0)
    return (
      <div className="mt-2 rounded-2xl border-2 border-[#1B1340] bg-[#FFF3C4] p-3">
        <p className={`mb-2 ${note}`}>
          Comparing needs a price. Type one from a quote or a nearby listing.
        </p>
        <NumberFields
          fields={[
            {
              label: "Price (₱)",
              value: price,
              onChange: onPriceChange,
              step: 100_000,
            },
          ]}
        />
      </div>
    );

  if (!rvbLast) return null;

  return (
    <>
      <p className={label}>If you rent, invest in</p>
      <div className="mb-1 flex flex-wrap gap-2">
        {ALTERNATIVE_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setAlt(id)}
            className={chip(alt === id)}
          >
            {ALTERNATIVES[id].emoji} {ALTERNATIVES[id].label}
          </button>
        ))}
        <button
          onClick={() => setAlt("custom")}
          className={chip(alt === "custom")}
        >
          ✏️ My own rate
        </button>
      </div>
      {altInfo && (
        <p className={`mb-3 ${note}`}>
          {altInfo.blurb} ~{pct(altInfo.returns.expected)}/yr after tax.
          {altInfo.lockInYears > horizon &&
            ` Locked in for ${altInfo.lockInYears} yrs.`}
        </p>
      )}
      <NumberFields fields={rentInputs} />
      {compRentInput === null && (
        <p className={`mt-1 ${note}`}>
          Estimated at 5% of the price a year. Check listings nearby.
        </p>
      )}

      <div
        className="mt-4 rounded-2xl border-2 border-[#1B1340] p-4 shadow-[3px_3px_0_0_#1B1340]"
        style={{ background: rvb.advantage >= 0 ? "#BEF264" : "#DDF3FF" }}
        aria-live="polite"
      >
        <p className="text-2xl font-black">
          {rvb.advantage >= 0 ? "Buying" : "Renting"} wins by{" "}
          {compact(Math.abs(rvb.advantage))}
        </p>
        <p className="text-sm font-semibold">
          after {horizon} years, if you invest the difference every month
        </p>
        <p className="mt-2 text-sm font-semibold">
          {rentVsBuyReason({
            price,
            monthlyRent: compRent,
            loanRate: annualRate,
            appreciation: apprPct / 100,
            investReturn: altReturns.expected,
            investLabel,
            advantage: rvb.advantage,
          })}
          {rvb.advantage >= 0 &&
            rvb.breakEvenYear &&
            ` Pulls ahead in year ${rvb.breakEvenYear}.`}
        </p>
        {isVolatile(altReturns) && (
          <p className="mt-1 text-xs font-semibold">
            At {pct(altReturns.low)}/yr: {ahead(scenarios.low.advantage)}. At{" "}
            {pct(altReturns.high)}/yr: {ahead(scenarios.high.advantage)}.
          </p>
        )}
        {fixedYears < years && (
          <p className="mt-1 text-xs font-semibold">
            Assumes the loan rate stays {pct(annualRate)} after the {fixedYears}
            -yr fixed period. If it rises, renting looks better.
          </p>
        )}
      </div>

      {/* Where the money goes, side by side */}
      <div className="mt-3 grid grid-cols-1 gap-3 text-xs font-semibold sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-[#1B1340] bg-white p-3">
          <p className="mb-1 text-sm font-extrabold">🔑 Buy</p>
          <Row label="Upfront" value={compact(rvb.breakdown.upfront)} />
          <Row label="Monthly" value={peso(rvb.breakdown.ownCostStart)} />
          <Row
            label="Place worth"
            value={compact(rvb.breakdown.propertyValue)}
          />
          <Row
            label="Loan still owed"
            value={`−${compact(rvb.breakdown.loanLeft)}`}
          />
          <Row
            label="Selling costs (tax, broker)"
            value={`−${compact(rvb.breakdown.sellingCosts)}`}
          />
          {rvb.breakdown.buyerInvestments > 0 && (
            <Row
              label="Invested savings"
              value={`+${compact(rvb.breakdown.buyerInvestments)}`}
            />
          )}
          <Row
            label="You'd have"
            value={compact(rvbLast.buyerNetWorth)}
            total
          />
        </div>
        <div className="rounded-2xl border-2 border-[#1B1340] bg-white p-3">
          <p className="mb-1 text-sm font-extrabold">🏠 Rent + invest</p>
          <Row label="Monthly rent" value={peso(rvb.breakdown.rentStart)} />
          <Row
            label="Invested at start"
            value={compact(rvb.breakdown.upfront)}
          />
          {rvb.breakdown.renterMonthlyStart > 0 &&
            (Math.abs(
              rvb.breakdown.renterMonthlyStart - rvb.breakdown.renterMonthlyEnd,
            ) < 500 ? (
              <Row
                label="Invested monthly"
                value={compact(rvb.breakdown.renterMonthlyStart)}
              />
            ) : (
              <>
                <Row
                  label="Invested/mo in year 1"
                  value={compact(rvb.breakdown.renterMonthlyStart)}
                />
                <Row
                  label={`Invested/mo by year ${horizon}`}
                  value={compact(rvb.breakdown.renterMonthlyEnd)}
                />
              </>
            ))}
          <Row
            label="Total put in"
            value={compact(rvb.breakdown.renterPaidIn)}
          />
          <Row
            label="You'd have"
            value={compact(rvbLast.renterNetWorth)}
            total
          />
        </div>
      </div>

      <details className="mt-3 rounded-2xl border-2 border-[#1B1340] bg-white p-3">
        <summary className="cursor-pointer text-sm font-extrabold">
          Change assumptions
        </summary>
        <div className="mt-2">
          <NumberFields fields={assumptionInputs} />
        </div>
      </details>
    </>
  );
}

function ahead(advantage: number) {
  return `${advantage >= 0 ? "buying" : "renting"} wins by ${compact(Math.abs(advantage))}`;
}
