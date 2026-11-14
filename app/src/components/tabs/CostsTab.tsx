import { total, type Breakdown, type RentItem } from "../../lib/cost-of-living";
import { peso } from "../../lib/format";
import { RentItemPicker, note } from "../ui";

const CATS = ["Rent", "Utilities", "Transport", "Food"] as const;
const COLORS: Record<(typeof CATS)[number], string> = {
  Rent: "#A78BFA",
  Utilities: "#5EEAD4",
  Transport: "#FFB84D",
  Food: "#FF8FA3",
};

export default function CostsTab({
  breakdowns,
  rentItem,
  setRentItem,
  color,
  onCity,
}: {
  breakdowns: Breakdown[];
  rentItem: RentItem;
  setRentItem: (r: RentItem) => void;
  color: (city: string) => string;
  onCity: (city: string) => void;
}) {
  const maxTotal = Math.max(1, ...breakdowns.map(total));

  return (
    <>
      <RentItemPicker value={rentItem} onChange={setRentItem} />

      {breakdowns.map((b) => (
        <section
          key={b.city}
          onClick={() => onCity(b.city)}
          style={{ borderLeftColor: color(b.city) }}
          className="mb-3 cursor-pointer rounded-2xl border-2 border-l-[12px] border-[#1B1340] bg-white p-4 shadow-[3px_3px_0_0_#1B1340] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#1B1340]"
        >
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-extrabold">{b.city}</h3>
            <span className="text-xl font-black">
              {peso(total(b))}
              <span className="text-xs font-semibold text-[#1B1340]/60">
                {" "}
                /mo
              </span>
            </span>
          </div>
          <div
            className="my-3 flex h-6 overflow-hidden rounded-md border-2 border-[#1B1340] bg-white"
            style={{ width: `${(total(b) / maxTotal) * 100}%` }}
          >
            {CATS.map((k) => (
              <i
                key={k}
                title={k}
                className="border-r-2 border-[#1B1340] last:border-r-0"
                style={{
                  width: `${(b[k] / total(b)) * 100}%`,
                  background: COLORS[k],
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#1B1340]/70">
            {CATS.map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm border-2 border-[#1B1340]"
                  style={{ background: COLORS[k] }}
                />
                {k} <b className="text-[#1B1340]">{peso(b[k])}</b>
              </span>
            ))}
          </div>
        </section>
      ))}
      <p className={`mt-2 ${note}`}>
        Single person. Utilities assume 150 kWh of electricity plus water and
        internet. Tap a city to see it on the map.
      </p>
    </>
  );
}
