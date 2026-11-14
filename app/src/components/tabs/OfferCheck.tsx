import { useState } from "react";
import { peso } from "../../lib/format";
import { grossToNet } from "../../lib/payroll";
import { Row, chip, field, label, note, resultCard } from "../ui";

export default function OfferCheck() {
  const [payMode, setPayMode] = useState<"gross" | "net">("gross");
  // Your own monthly costs (rent, utilities, commute, food) for each option,
  // e.g. a cheaper place near the current job vs a pricier one near the offer.
  const [fromCost, setFromCost] = useState(30_000);
  const [toCost, setToCost] = useState(30_000);
  const [fromPay, setFromPay] = useState(35000);
  const [toPay, setToPay] = useState(60000);

  const fromPayCalc = grossToNet(fromPay);
  const toPayCalc = grossToNet(toPay);
  const fromTakeHome = payMode === "gross" ? fromPayCalc.net : fromPay;
  const toTakeHome = payMode === "gross" ? toPayCalc.net : toPay;
  const nowCost = fromCost;
  const offerCost = toCost;
  const leftNow = fromTakeHome - nowCost;
  const leftOffer = toTakeHome - offerCost;
  const diff = leftOffer - leftNow;

  const sides = [
    {
      title: "Now",
      cost: fromCost,
      setCost: setFromCost,
      pay: fromPay,
      setPay: setFromPay,
      bg: "#DDF3FF",
    },
    {
      title: "Offer",
      cost: toCost,
      setCost: setToCost,
      pay: toPay,
      setPay: setToPay,
      bg: "#FFE3EA",
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setPayMode("gross")}
          className={chip(payMode === "gross")}
        >
          I have the gross salary
        </button>
        <button
          onClick={() => setPayMode("net")}
          className={chip(payMode === "net")}
        >
          I know my take-home
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sides.map((f) => (
          <div
            key={f.title}
            style={{ background: f.bg }}
            className="rounded-2xl border-2 border-[#1B1340] p-3 shadow-[3px_3px_0_0_#1B1340]"
          >
            <p className="mb-2 text-base font-extrabold">{f.title}</p>
            <label className={label}>
              {payMode === "gross"
                ? "Gross monthly salary (₱)"
                : "Monthly take-home (₱)"}
              <input
                type="number"
                min={0}
                step={1000}
                value={f.pay}
                onChange={(e) =>
                  f.setPay(Math.max(0, Number(e.target.value) || 0))
                }
                className={`${field} mt-0.5 text-[#1B1340]`}
              />
            </label>
            <label className={`${label} mt-2 block`}>
              Living costs incl. rent (₱/mo)
              <input
                type="number"
                min={0}
                step={1000}
                value={f.cost}
                onChange={(e) =>
                  f.setCost(Math.max(0, Number(e.target.value) || 0))
                }
                className={`${field} mt-0.5 text-[#1B1340]`}
              />
            </label>
          </div>
        ))}
      </div>

      {payMode === "gross" && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-semibold">
          {[fromPayCalc, toPayCalc].map((p, i) => (
            <div
              key={i}
              className="rounded-2xl border-2 border-[#1B1340] bg-white p-3"
            >
              <Row label="SSS" value={`−${peso(p.sss)}`} />
              <Row label="PhilHealth" value={`−${peso(p.philhealth)}`} />
              <Row label="Pag-IBIG" value={`−${peso(p.pagibig)}`} />
              <Row label="Income tax" value={`−${peso(p.tax)}`} />
              <Row label="Take-home" value={peso(p.net)} total />
            </div>
          ))}
        </div>
      )}

      <div className={`mt-4 ${resultCard}`} aria-live="polite">
        <div
          className={`text-5xl font-black ${diff >= 0 ? "text-[#BEF264]" : "text-[#FF8FA3]"}`}
        >
          {diff >= 0 ? "+" : "−"}
          {peso(Math.abs(diff))}
        </div>
        <p className="mt-2 text-sm font-semibold">
          {diff >= 0 ? "More" : "Less"} left over each month after taxes and
          living costs if you take the offer.
        </p>
        <p className="mt-2 text-xs text-white/60">
          Now: {peso(leftNow)} left ({peso(fromTakeHome)} take-home,{" "}
          {peso(nowCost)} costs). Offer: {peso(leftOffer)} left (
          {peso(toTakeHome)} take-home, {peso(offerCost)} costs).
        </p>
      </div>

      {payMode === "gross" && (
        <p className={`mt-3 ${note}`}>
          Estimate for a regular employee on basic monthly pay. It excludes the
          13th-month pay, bonuses, allowances, and HMO. Your payslip may differ
          slightly.
        </p>
      )}
    </>
  );
}
