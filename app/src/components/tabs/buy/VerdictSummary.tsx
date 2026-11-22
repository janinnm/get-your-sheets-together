import { peso, short } from "../../../lib/format";
import type { Affordability, Verdict } from "../../../lib/mortgage";
import { Row, resultCard } from "../../ui";

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

/** Headline verdict, cash upfront, monthly budget, and key thresholds. */
export default function VerdictSummary({
  verdict,
  r,
  price,
  maxPrice,
  years,
  takeHome,
  livingCosts,
  livingLabel,
  otherCosts,
  kindLabel,
}: {
  verdict: Verdict;
  r: Affordability;
  price: number;
  maxPrice: number;
  years: number;
  takeHome: number;
  livingCosts: number;
  livingLabel: string;
  otherCosts: number;
  kindLabel: string;
}) {
  return (
    <>
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
          <Row label="Take-home" value={peso(takeHome)} />
          <Row label={livingLabel} value={`−${peso(livingCosts)}`} />
          <Row label="Loan" value={`−${peso(r.monthlyPayment)}`} />
          <Row label="Dues, tax, upkeep" value={`−${peso(otherCosts)}`} />
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
          label={`Max ${kindLabel.toLowerCase()} price you qualify for`}
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
    </>
  );
}
