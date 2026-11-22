import { peso } from "../../../lib/format";
import type { ShockRow } from "../../../lib/mortgage";
import { chip, label, note } from "../../ui";

const FIXED_PERIODS = [1, 3, 5, 10];

/** "What if rates go up?": payments after the fixed-rate period ends. */
export default function RateShock({
  shock,
  fixedYears,
  setFixedYears,
  loanYears,
  mustSurviveShockPct,
  maxDti,
}: {
  shock: { balanceAtReset: number; yearsLeft: number; rows: ShockRow[] };
  fixedYears: number;
  setFixedYears: (y: number) => void;
  loanYears: number;
  mustSurviveShockPct: number;
  maxDti: number;
}) {
  return (
    <>
      <p className={`mb-2 ${label}`}>
        Bank rates are usually fixed for a few years, then reprice to the market
        rate on the balance left.
      </p>
      <p className={label}>Fixed period (years)</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {FIXED_PERIODS.map((y) => (
          <button
            key={y}
            onClick={() => setFixedYears(y)}
            className={chip(fixedYears === y)}
            disabled={y > loanYears}
          >
            {y} yr{y > 1 ? "s" : ""}
          </button>
        ))}
      </div>
      {shock.yearsLeft > 0 ? (
        <>
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
                    className={`border-t-2 border-[#1B1340]/10 ${s.shockPct === mustSurviveShockPct ? "bg-[#F6F3FF]" : ""}`}
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
          <p className={`mt-2 ${note}`}>
            At year {Math.min(fixedYears, loanYears)} you&apos;d still owe{" "}
            {peso(shock.balanceAtReset)} over {shock.yearsLeft} years. The
            highlighted row is the rise your profile should survive. ⚠️ means
            the payment is above {Math.round(maxDti * 100)}% of today&apos;s
            gross income.
          </p>
        </>
      ) : (
        <p className="text-sm font-semibold">
          The rate is fixed for the whole loan, so there&apos;s no reset.
        </p>
      )}
    </>
  );
}
