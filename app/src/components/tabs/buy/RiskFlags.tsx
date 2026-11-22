import type { Flag } from "../../../lib/risk";

const FLAG_STYLE: Record<Flag["level"], { bg: string; icon: string }> = {
  high: { bg: "#FFE3EA", icon: "🚩" },
  medium: { bg: "#FFF3C4", icon: "⚠️" },
  info: { bg: "#FFFFFF", icon: "💡" },
};

export default function RiskFlags({ flags }: { flags: Flag[] }) {
  return (
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
  );
}
