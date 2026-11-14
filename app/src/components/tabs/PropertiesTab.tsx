import type { RefObject } from "react";
import { peso, short } from "../../lib/format";
import {
  CONDO_SQM,
  KINDS,
  KIND_EMOJI,
  KIND_LABEL,
  grossYield,
  type Kind,
  type Listing,
} from "../../lib/listings";
import { chip } from "../ui";

type Status = "all" | "ready" | "preselling";
const BUDGETS = [5_000_000, 10_000_000, 20_000_000];

export type Filters = {
  kinds: Set<Kind>;
  status: Status;
  budget: number | null;
};

export function matches(l: Listing, f: Filters) {
  return (
    f.kinds.has(l.kind) &&
    (f.status === "all" || l.status === f.status) &&
    (f.budget === null || l.price <= f.budget)
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
  color: (city: string) => string;
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
      <div className="mb-3 flex flex-wrap gap-2">
        {(["all", "ready", "preselling"] as Status[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilters({ ...filters, status: s })}
            className={chip(filters.status === s)}
          >
            {s === "all"
              ? "Any status"
              : s === "ready"
                ? "Ready"
                : "Preselling"}
          </button>
        ))}
        {BUDGETS.map((b) => (
          <button
            key={b}
            onClick={() =>
              setFilters({
                ...filters,
                budget: filters.budget === b ? null : b,
              })
            }
            className={chip(filters.budget === b)}
          >
            Under {short(b)}
          </button>
        ))}
      </div>

      <p className="mb-3 text-sm font-semibold text-[#1B1340]/70">
        {visible.length} properties in this map area
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
          color={color(l.city)}
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
  const y = grossYield(l);
  const size =
    l.kind === "condo"
      ? `for ${CONDO_SQM} sqm`
      : [
          l.lotArea && `${l.lotArea} sqm lot`,
          l.floorArea && `${l.floorArea} sqm floor`,
        ]
          .filter(Boolean)
          .join(", ");

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
          src={l.image.url}
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
            {l.area}
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
          {l.area}, {l.city}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-lg border-2 border-[#1B1340] bg-[#FFF3C4] px-2 py-1 text-sm font-extrabold">
            {short(l.price)}{" "}
            <span className="text-xs font-semibold">{size}</span>
          </span>
          {l.rentMonthly && (
            <span className="rounded-lg border-2 border-[#1B1340] bg-[#DDF3FF] px-2 py-1 text-sm font-bold">
              {peso(l.rentMonthly)}/mo rent
            </span>
          )}
          {y !== null && (
            <span className="rounded-lg border-2 border-[#1B1340] bg-[#BEF264] px-2 py-1 text-sm font-extrabold">
              {y.toFixed(1)}% yield
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onBuy();
          }}
          className="mt-3 rounded-lg border-2 border-[#1B1340] bg-[#1B1340] px-3 py-1.5 text-sm font-extrabold text-white shadow-[2px_2px_0_0_#A78BFA] transition hover:-translate-y-0.5"
        >
          🔑 Can I afford this?
        </button>

        <p className="mt-3 text-[11px] leading-snug text-[#1B1340]/50">
          {l.source}, {l.asOf}
        </p>
        {l.image?.credit && (
          <p className="text-[10px] text-[#1B1340]/40">
            Photo: {l.image.credit}
            {l.image.license && `, ${l.image.license}`}
          </p>
        )}
      </div>
    </article>
  );
}
