// Shared building blocks for the panel tabs.

export const INK = "#1B1340";

export const chip = (active: boolean) =>
  `whitespace-nowrap rounded-full border-2 border-[#1B1340] px-3 py-1.5 text-sm font-bold transition disabled:opacity-40 ${
    active
      ? "bg-[#A78BFA] shadow-[2px_2px_0_0_#1B1340]"
      : "bg-white hover:bg-[#FFF3C4]"
  }`;

export const field =
  "w-full rounded-lg border-2 border-[#1B1340] bg-white p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A78BFA]";

export const label = "text-xs font-semibold text-[#1B1340]/70";
export const note = "text-xs font-semibold text-[#1B1340]/60";

/** The dark headline card used for each tab's main result. */
export const resultCard =
  "rounded-2xl border-2 border-[#1B1340] bg-[#1B1340] p-5 text-white shadow-[4px_4px_0_0_#A78BFA]";

export type NumberInput = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  max?: number;
};

/** Two-column grid of non-negative number inputs. */
export function NumberFields({ fields }: { fields: NumberInput[] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.label}>
          <label className={label}>
            {f.label}
            <input
              type="number"
              min={0}
              max={f.max}
              step={f.step ?? 1}
              value={f.value}
              onChange={(e) =>
                f.onChange(Math.max(0, Number(e.target.value) || 0))
              }
              className={`${field} mt-0.5 text-[#1B1340]`}
            />
          </label>
        </div>
      ))}
    </div>
  );
}

/** A label/value line in a breakdown box. */
export function Row({
  label,
  value,
  total,
  warn,
  bold,
}: {
  label: string;
  value: string;
  total?: boolean;
  warn?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={`flex justify-between gap-2 ${total ? "mt-1 border-t-2 border-[#1B1340] pt-1 font-extrabold" : ""} ${warn ? "text-[#D6336C]" : ""}`}
    >
      <span>{label}</span>
      {bold ? <b>{value}</b> : <span>{value}</span>}
    </div>
  );
}
