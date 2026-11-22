import type { RefObject } from "react";
import { peso, short } from "../../lib/format";
import {
  FLOOD_LABEL,
  LIQUEFACTION_LABEL,
  KINDS,
  KIND_EMOJI,
  KIND_LABEL,
  type FloodLevel,
  type Kind,
  type Listing,
} from "../../lib/listings";
import { chip } from "../ui";

const FLOOD_BG: Record<Exclude<FloodLevel, "none">, string> = {
  low: "bg-[#DDF3FF]",
  medium: "bg-[#FDE047]",
  high: "bg-[#FCA5A5]",
};

type Status = "all" | "ready" | "preselling";
const BUDGETS = [5_000_000, 10_000_000, 20_000_000];

/** "no-high" hides high flood zones; "dry" keeps only low or unmapped ones. */
type Flood = "any" | "no-high" | "dry";
const FLOOD_OK: Record<Flood, FloodLevel[]> = {
  any: ["none", "low", "medium", "high"],
  "no-high": ["none", "low", "medium"],
  dry: ["none", "low"],
};
const FLOOD_OPTIONS: [Flood, string][] = [
  ["any", "Any flood risk"],
  ["no-high", "No high flood risk"],
  ["dry", "Low or no flood risk"],
];

export type Filters = {
  kinds: Set<Kind>;
  status: Status;
  budget: number | null;
  flood: Flood;
  /** Hide projects on ground with high liquefaction potential. */
  firmGround: boolean;
};

export const NO_FILTERS: Filters = {
  kinds: new Set(KINDS),
  status: "all",
  budget: null,
  flood: "any",
  firmGround: false,
};

function hazardCount(f: Filters) {
  return Number(f.flood !== "any") + Number(f.firmGround);
}

function isFiltered(f: Filters) {
  return (
    f.kinds.size < KINDS.length ||
    f.status !== "all" ||
    f.budget !== null ||
    hazardCount(f) > 0
  );
}

const CHEVRON = (
  <span aria-hidden className="pointer-events-none text-xs">
    ▾
  </span>
);

/** A chip that opens a native select: compact, and keyboard and screen-reader friendly. */
function Dropdown({
  label,
  value,
  active,
  options,
  onChange,
}: {
  label: string;
  value: string;
  active: boolean;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className={`relative flex items-center gap-1 ${chip(active)}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-1 font-bold outline-none"
      >
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
      {CHEVRON}
    </label>
  );
}

/** Flood and liquefaction filters, folded into one chip with a small panel. */
function HazardFilter({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const n = hazardCount(filters);
  return (
    <details className="relative">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden ${chip(n > 0)}`}
      >
        🛡️ Hazards{n > 0 && ` · ${n}`} {CHEVRON}
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-64 rounded-xl border-2 border-[#1B1340] bg-white p-3 text-sm font-semibold shadow-[3px_3px_0_0_#1B1340]">
        <p className="mb-1 font-extrabold">🌊 Flood (Project NOAH)</p>
        {FLOOD_OPTIONS.map(([v, text]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 py-0.5">
            <input
              type="radio"
              name="flood"
              checked={filters.flood === v}
              onChange={() => setFilters({ ...filters, flood: v })}
              className="accent-[#A78BFA]"
            />
            {text}
          </label>
        ))}
        <p className="mb-1 mt-3 font-extrabold">🫨 Earthquake (PHIVOLCS)</p>
        <label className="flex cursor-pointer items-center gap-2 py-0.5">
          <input
            type="checkbox"
            checked={filters.firmGround}
            onChange={(e) =>
              setFilters({ ...filters, firmGround: e.target.checked })
            }
            className="accent-[#A78BFA]"
          />
          No high liquefaction
        </label>
      </div>
    </details>
  );
}

export function matches(l: Listing, f: Filters) {
  return (
    f.kinds.has(l.kind) &&
    (f.status === "all" || l.status === f.status) &&
    FLOOD_OK[f.flood].includes(l.floodLevel) &&
    (!f.firmGround || l.liquefactionLevel !== "high") &&
    // A budget filter keeps only projects with a published price under it.
    (f.budget === null || (l.priceLow !== null && l.priceLow <= f.budget))
  );
}

export default function PropertiesTab({
  visible,
  filters,
  setFilters,
  activeId,
  setHovered,
  onSelect,
  onBuy,
  cardRefs,
  color,
}: {
  visible: Listing[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  activeId: (id: string) => boolean;
  setHovered: (id: string | null) => void;
  onSelect: (l: Listing) => void;
  onBuy: (l: Listing) => void;
  cardRefs: RefObject<Record<string, HTMLElement | null>>;
  color: (developer: string) => string;
}) {
  function toggleKind(k: Kind) {
    const kinds = new Set(filters.kinds);
    if (kinds.has(k)) kinds.delete(k);
    else kinds.add(k);
    setFilters({ ...filters, kinds: kinds.size ? kinds : new Set(KINDS) });
  }

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => toggleKind(k)}
            className={chip(filters.kinds.has(k))}
            aria-pressed={filters.kinds.has(k)}
          >
            {KIND_EMOJI[k]} {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Dropdown
          label="Status"
          value={filters.status}
          active={filters.status !== "all"}
          options={[
            ["all", "Any status"],
            ["ready", "Ready"],
            ["preselling", "Preselling"],
          ]}
          onChange={(v) => setFilters({ ...filters, status: v as Status })}
        />
        <Dropdown
          label="Budget"
          value={String(filters.budget ?? "")}
          active={filters.budget !== null}
          options={[
            ["", "Any budget"],
            ...BUDGETS.map((b): [string, string] => [
              String(b),
              `Under ${short(b)}`,
            ]),
          ]}
          onChange={(v) =>
            setFilters({ ...filters, budget: v ? Number(v) : null })
          }
        />
        <HazardFilter filters={filters} setFilters={setFilters} />
        {isFiltered(filters) && (
          <button
            onClick={() => setFilters(NO_FILTERS)}
            className="px-1 text-sm font-bold text-[#1B1340]/60 underline hover:text-[#1B1340]"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mb-3 text-sm font-semibold text-[#1B1340]/70">
        {visible.length} projects in this map area
      </p>

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm font-semibold text-[#1B1340]/60">
          Nothing matches here. Zoom out or clear a filter.
        </p>
      )}

      {visible.map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          active={activeId(l.id)}
          color={color(l.developer)}
          ref={(el) => {
            cardRefs.current[l.id] = el;
          }}
          onSelect={() => onSelect(l)}
          onBuy={() => onBuy(l)}
          onHover={(on) => setHovered(on ? l.id : null)}
        />
      ))}
    </>
  );
}

function ListingCard({
  listing: l,
  active,
  color,
  ref,
  onSelect,
  onBuy,
  onHover,
}: {
  listing: Listing;
  active: boolean;
  color: string;
  ref: (el: HTMLElement | null) => void;
  onSelect: () => void;
  onBuy: () => void;
  onHover: (on: boolean) => void;
}) {
  const sizes =
    l.sizeLow &&
    (l.sizeHigh && l.sizeHigh > l.sizeLow
      ? `${l.sizeLow}–${l.sizeHigh} sqm`
      : `${l.sizeLow} sqm`);

  return (
    <article
      ref={ref}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={`mb-4 cursor-pointer overflow-hidden rounded-2xl border-2 border-[#1B1340] bg-white transition ${
        active
          ? "-translate-y-0.5 shadow-[5px_5px_0_0_#1B1340]"
          : "shadow-[3px_3px_0_0_#1B1340]"
      }`}
    >
      {l.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={l.image}
          alt={l.name}
          loading="lazy"
          className="h-32 w-full border-b-2 border-[#1B1340] object-cover"
        />
      ) : (
        <div
          className="relative flex h-32 items-end overflow-hidden border-b-2 border-[#1B1340] p-3"
          style={{ background: `linear-gradient(135deg, ${color}, #ffffff)` }}
        >
          <span
            aria-hidden
            className="absolute -right-1 -top-3 text-8xl opacity-90"
          >
            {KIND_EMOJI[l.kind]}
          </span>
          <span className="relative rounded-full border-2 border-[#1B1340] bg-white px-2.5 py-0.5 text-xs font-extrabold">
            {l.city}
          </span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold leading-tight">{l.name}</h3>
          <div className="flex shrink-0 gap-1">
            <span className="rounded-full border-2 border-[#1B1340] bg-[#F6F3FF] px-2 py-0.5 text-xs font-bold">
              {KIND_LABEL[l.kind]}
            </span>
            {l.status && (
              <span
                className={`rounded-full border-2 border-[#1B1340] px-2 py-0.5 text-xs font-bold ${
                  l.status === "ready" ? "bg-[#BEF264]" : "bg-[#FDE047]"
                }`}
              >
                {l.status === "ready" ? "Ready" : "Preselling"}
              </span>
            )}
          </div>
        </div>
        <p className="text-sm font-semibold text-[#1B1340]/60">
          {l.developer} · {l.city}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border-2 border-[#1B1340] bg-[#FFF3C4] px-2 py-1 text-sm font-extrabold">
            {l.priceLow
              ? l.priceHigh && l.priceHigh > l.priceLow
                ? `${short(l.priceLow)} – ${short(l.priceHigh)}`
                : `From ${short(l.priceLow)}`
              : "Price on request"}
          </span>
          {l.monthlyFrom && (
            <span className="rounded-lg border-2 border-[#1B1340] bg-[#DDF3FF] px-2 py-1 text-sm font-bold">
              Ads: from {peso(l.monthlyFrom)}/mo
            </span>
          )}
          {sizes && (
            <span className="rounded-lg border-2 border-[#1B1340] bg-white px-2 py-1 text-sm font-bold">
              {sizes}
            </span>
          )}
          {l.floodLevel !== "none" && (
            <span
              className={`rounded-lg border-2 border-[#1B1340] px-2 py-1 text-sm font-bold ${FLOOD_BG[l.floodLevel]}`}
              title="Project NOAH 100-year flood map"
            >
              🌊 {FLOOD_LABEL[l.floodLevel]}
            </span>
          )}
          {(l.liquefactionLevel === "moderate" ||
            l.liquefactionLevel === "high") && (
            <span
              className={`rounded-lg border-2 border-[#1B1340] px-2 py-1 text-sm font-bold ${
                l.liquefactionLevel === "high" ? "bg-[#FDBA74]" : "bg-[#FEF3C7]"
              }`}
              title="PHIVOLCS liquefaction hazard map: how likely the ground turns soft in a strong earthquake"
            >
              🫨 {LIQUEFACTION_LABEL[l.liquefactionLevel]}
            </span>
          )}
        </div>
        {l.turnover && (
          <p className="mt-2 text-xs font-semibold text-[#1B1340]/60">
            Turnover: {l.turnover}
          </p>
        )}

        <button
          onClick={(e) => {
            e.stopPropagation();
            onBuy();
          }}
          className="mt-3 block rounded-lg border-2 border-[#1B1340] bg-[#1B1340] px-3 py-1.5 text-sm font-extrabold text-white shadow-[2px_2px_0_0_#A78BFA] transition hover:-translate-y-0.5"
        >
          🔑 Can I afford this?
        </button>

        <p className="mt-3 text-[11px] leading-snug text-[#1B1340]/50">
          From{" "}
          <a
            href={l.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="underline"
          >
            {new URL(l.url).hostname.replace(/^www\./, "")}
          </a>
          , {l.scrapedAt}
          {l.image && ". Photo from the developer's site"}
          {l.floodLevel !== "none" && ". Flood level from Project NOAH"}
          {l.liquefactionLevel !== "none" && ". Liquefaction from PHIVOLCS"}
        </p>
      </div>
    </article>
  );
}
