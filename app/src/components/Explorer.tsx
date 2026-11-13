"use client";

import { useMemo, useRef, useState } from "react";
import { setWorkerUrl, type LngLatBounds } from "maplibre-gl";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Condo, CostRow } from "../types/data";
import { monthlyBreakdown, total } from "../lib/calc";
import { grossToNet } from "../lib/payroll";

setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE = "https://tiles.openfreemap.org/styles/liberty"; // free, no API key
const SQM = 30; // assumed unit size for the headline price
const BUDGET = 5_000_000;
const INK = "#1B1340";

const CATS = ["Rent", "Utilities", "Transport", "Food"] as const;
const COLORS: Record<(typeof CATS)[number], string> = {
  Rent: "#A78BFA",
  Utilities: "#5EEAD4",
  Transport: "#FFB84D",
  Food: "#FF8FA3",
};
const PALETTE = [
  "#FF8FA3",
  "#A78BFA",
  "#FFB84D",
  "#5EEAD4",
  "#7DD3FC",
  "#BEF264",
  "#F9A8D4",
  "#FDE047",
  "#86EFAC",
  "#A5B4FC",
];

const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");
const short = (n: number) => `₱${(n / 1_000_000).toFixed(1)}M`;
const unitPrice = (c: Condo) =>
  (((c.price_per_sqm_low ?? 0) + (c.price_per_sqm_high ?? 0)) / 2) * SQM;
const yieldPct = (c: Condo) =>
  c.rent_1br_monthly ? ((c.rent_1br_monthly * 12) / unitPrice(c)) * 100 : null;

type Tab = "condos" | "costs" | "offer";
type Status = "all" | "ready" | "preselling";

export default function Explorer({
  costs,
  condos,
}: {
  costs: CostRow[];
  condos: Condo[];
}) {
  const mapRef = useRef<MapRef>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const [tab, setTab] = useState<Tab>("condos");
  const [rentItem, setRentItem] = useState<"1BR condo" | "Bedspace">(
    "1BR condo",
  );

  // condo state
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bounds, setBounds] = useState<LngLatBounds | null>(null);
  const [status, setStatus] = useState<Status>("all");
  const [underBudget, setUnderBudget] = useState(false);

  // data derived from the dataset
  const cities = useMemo(() => [...new Set(costs.map((r) => r.city))], [costs]);
  const cityColor = useMemo(
    () =>
      Object.fromEntries(
        cities.map((c, i) => [c, PALETTE[i % PALETTE.length]]),
      ),
    [cities],
  );
  const color = (city: string) => cityColor[city] ?? "#E5E7EB";

  const breakdowns = useMemo(
    () =>
      cities
        .map((c) => monthlyBreakdown(costs, c, rentItem))
        .sort((a, b) => total(a) - total(b)),
    [cities, costs, rentItem],
  );
  const maxTotal = Math.max(1, ...breakdowns.map(total));

  const cityCenters = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const city of cities) {
      const cs = condos.filter((c) => c.city === city);
      if (cs.length)
        out[city] = [
          cs.reduce((s, c) => s + c.lng, 0) / cs.length,
          cs.reduce((s, c) => s + c.lat, 0) / cs.length,
        ];
    }
    return out;
  }, [cities, condos]);

  // offer check state
  const [payMode, setPayMode] = useState<"gross" | "net">("gross");
  const [fromCity, setFromCity] = useState(breakdowns[0]?.city ?? "");
  const [toCity, setToCity] = useState(
    breakdowns[breakdowns.length - 1]?.city ?? "",
  );
  const [fromPay, setFromPay] = useState(35000);
  const [toPay, setToPay] = useState(60000);

  const filtered = useMemo(
    () =>
      condos.filter(
        (c) =>
          (status === "all" || c.turnover_status === status) &&
          (!underBudget || unitPrice(c) <= BUDGET),
      ),
    [condos, status, underBudget],
  );
  const visible = useMemo(
    () =>
      bounds
        ? filtered.filter((c) => bounds.contains([c.lng, c.lat]))
        : filtered,
    [bounds, filtered],
  );

  const initialBounds = useMemo(() => {
    const lngs = condos.map((c) => c.lng);
    const lats = condos.map((c) => c.lat);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, [condos]);

  function selectCondo(c: Condo, fromMap: boolean) {
    setSelected(c.id);
    setTab("condos");
    mapRef.current?.flyTo({ center: [c.lng, c.lat], zoom: 14, duration: 800 });
    if (fromMap)
      setTimeout(
        () =>
          cardRefs.current[c.id]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          }),
        900,
      );
  }

  function flyToCity(city: string) {
    const center = cityCenters[city];
    if (center) mapRef.current?.flyTo({ center, zoom: 12, duration: 900 });
  }

  const chip = (active: boolean) =>
    `whitespace-nowrap rounded-full border-2 border-[#1B1340] px-3 py-1.5 text-sm font-bold transition ${
      active
        ? "bg-[#A78BFA] shadow-[2px_2px_0_0_#1B1340]"
        : "bg-white hover:bg-[#FFF3C4]"
    }`;

  const field =
    "w-full rounded-lg border-2 border-[#1B1340] bg-white p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#A78BFA]";

  // offer math
  const fromPayCalc = grossToNet(fromPay);
  const toPayCalc = grossToNet(toPay);
  const fromTakeHome = payMode === "gross" ? fromPayCalc.net : fromPay;
  const toTakeHome = payMode === "gross" ? toPayCalc.net : toPay;
  const nowCost = total(monthlyBreakdown(costs, fromCity, rentItem));
  const offerCost = total(monthlyBreakdown(costs, toCity, rentItem));
  const leftNow = fromTakeHome - nowCost;
  const leftOffer = toTakeHome - offerCost;
  const diff = leftOffer - leftNow;

  const tabs: [Tab, string, string][] = [
    ["condos", "Condos", "🏢"],
    ["costs", "Cost of living", "💸"],
    ["offer", "Offer check", "🧮"],
  ];

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Full-bleed map */}
      <div className="absolute inset-0">
        <Map
          ref={mapRef}
          initialViewState={{
            bounds: initialBounds,
            fitBoundsOptions: { padding: 100 },
          }}
          mapStyle={STYLE}
          onLoad={(e) => setBounds(e.target.getBounds())}
          onMoveEnd={(e) => setBounds(e.target.getBounds())}
          onClick={() => setSelected(null)}
        >
          <NavigationControl position="top-right" />
          {filtered.map((c) => {
            const active = hovered === c.id || selected === c.id;
            return (
              <Marker
                key={c.id}
                longitude={c.lng}
                latitude={c.lat}
                anchor="bottom"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectCondo(c, true);
                  }}
                  onMouseEnter={() => setHovered(c.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ background: active ? INK : color(c.city) }}
                  className={`rounded-full border-2 border-[#1B1340] px-3 py-1 text-sm font-extrabold shadow-[2px_2px_0_0_#1B1340] transition ${
                    active ? "z-10 scale-110 text-white" : "text-[#1B1340]"
                  }`}
                >
                  {short(unitPrice(c))}
                </button>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* Floating panel: bottom sheet on mobile, side card on desktop */}
      <aside className="absolute bottom-0 left-0 z-10 flex max-h-[60%] w-full flex-col overflow-hidden rounded-t-3xl border-2 border-[#1B1340] bg-white text-[#1B1340] shadow-[6px_6px_0_0_#1B1340] lg:bottom-4 lg:left-4 lg:top-4 lg:max-h-none lg:w-[460px] lg:rounded-3xl">
        <header className="shrink-0 border-b-2 border-[#1B1340] bg-[#FFC845] px-5 pb-4 pt-5">
          <h1 className="text-4xl font-black leading-[0.95] tracking-tight sm:text-5xl">
            Get your sheets together
          </h1>
          <p className="mt-2 text-sm font-semibold text-[#1B1340]/70">
            Find where to live in Metro Manila. Placeholder data, not real
            market figures yet.
          </p>

          <div className="mt-4 flex gap-2">
            {tabs.map(([id, label, emoji]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex-1 rounded-xl border-2 border-[#1B1340] px-1 py-2 text-xs font-extrabold transition sm:text-sm ${
                  tab === id
                    ? "bg-[#1B1340] text-white shadow-[3px_3px_0_0_#A78BFA]"
                    : "bg-white hover:bg-[#FFF3C4]"
                }`}
              >
                <span aria-hidden>{emoji}</span> {label}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-[#F6F3FF] p-4">
          {/* ---------- CONDOS ---------- */}
          {tab === "condos" && (
            <>
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {(["all", "ready", "preselling"] as Status[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={chip(status === s)}
                  >
                    {s === "all"
                      ? "All"
                      : s === "ready"
                        ? "Ready"
                        : "Preselling"}
                  </button>
                ))}
                <button
                  onClick={() => setUnderBudget((v) => !v)}
                  className={chip(underBudget)}
                >
                  Under {short(BUDGET)}
                </button>
              </div>

              <p className="mb-3 text-sm font-semibold text-[#1B1340]/70">
                {visible.length} condos in this map area
              </p>

              {visible.length === 0 && (
                <p className="py-8 text-center text-sm font-semibold text-[#1B1340]/60">
                  No condos match here. Zoom out or clear a filter.
                </p>
              )}

              {visible.map((c) => {
                const y = yieldPct(c);
                const active = hovered === c.id || selected === c.id;
                return (
                  <article
                    key={c.id}
                    ref={(el) => {
                      cardRefs.current[c.id] = el;
                    }}
                    onClick={() => selectCondo(c, false)}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={`mb-4 cursor-pointer overflow-hidden rounded-2xl border-2 border-[#1B1340] bg-white transition ${
                      active
                        ? "-translate-y-0.5 shadow-[5px_5px_0_0_#1B1340]"
                        : "shadow-[3px_3px_0_0_#1B1340]"
                    }`}
                  >
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.image_url}
                        alt={c.name}
                        loading="lazy"
                        className="h-32 w-full border-b-2 border-[#1B1340] object-cover"
                      />
                    ) : (
                      <div
                        className="relative flex h-32 items-end overflow-hidden border-b-2 border-[#1B1340] p-3"
                        style={{
                          background: `linear-gradient(135deg, ${color(c.city)}, #ffffff)`,
                        }}
                      >
                        <span
                          aria-hidden
                          className="absolute -right-1 -top-3 text-8xl opacity-90"
                        >
                          🏙️
                        </span>
                        <span className="relative rounded-full border-2 border-[#1B1340] bg-white px-2.5 py-0.5 text-xs font-extrabold">
                          {c.area}
                        </span>
                      </div>
                    )}

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-extrabold leading-tight">
                          {c.name}
                        </h3>
                        {c.turnover_status && (
                          <span
                            className={`shrink-0 rounded-full border-2 border-[#1B1340] px-2 py-0.5 text-xs font-bold ${
                              c.turnover_status === "ready"
                                ? "bg-[#BEF264]"
                                : "bg-[#FDE047]"
                            }`}
                          >
                            {c.turnover_status === "ready"
                              ? "Ready"
                              : "Preselling"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-[#1B1340]/60">
                        {c.area}, {c.city}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg border-2 border-[#1B1340] bg-[#FFF3C4] px-2 py-1 text-sm font-extrabold">
                          {short(unitPrice(c))}{" "}
                          <span className="text-xs font-semibold">
                            for {SQM} sqm
                          </span>
                        </span>
                        {c.rent_1br_monthly && (
                          <span className="rounded-lg border-2 border-[#1B1340] bg-[#DDF3FF] px-2 py-1 text-sm font-bold">
                            {peso(c.rent_1br_monthly)}/mo rent
                          </span>
                        )}
                        {y !== null && (
                          <span className="rounded-lg border-2 border-[#1B1340] bg-[#BEF264] px-2 py-1 text-sm font-extrabold">
                            {y.toFixed(1)}% yield
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-[11px] leading-snug text-[#1B1340]/50">
                        {c.source}, {c.as_of_date}
                      </p>
                      {c.image_credit && (
                        <p className="text-[10px] text-[#1B1340]/40">
                          Photo: {c.image_credit}
                          {c.image_license && `, ${c.image_license}`}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </>
          )}

          {/* ---------- COST OF LIVING ---------- */}
          {tab === "costs" && (
            <>
              <div className="mb-4 flex gap-2">
                {(["1BR condo", "Bedspace"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRentItem(r)}
                    className={chip(rentItem === r)}
                  >
                    {r}
                  </button>
                ))}
              </div>

              {breakdowns.map((b) => (
                <section
                  key={b.city}
                  onClick={() => flyToCity(b.city)}
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
              <p className="mt-2 text-xs font-semibold text-[#1B1340]/60">
                Single person. Utilities assume 150 kWh of electricity plus
                water and internet. Tap a city to see it on the map.
              </p>
            </>
          )}

          {/* ---------- OFFER CHECK ---------- */}
          {tab === "offer" && (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {(["1BR condo", "Bedspace"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRentItem(r)}
                    className={chip(rentItem === r)}
                  >
                    {r}
                  </button>
                ))}
              </div>
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
                {[
                  {
                    title: "Now",
                    city: fromCity,
                    setCity: setFromCity,
                    pay: fromPay,
                    setPay: setFromPay,
                    bg: "#DDF3FF",
                  },
                  {
                    title: "Offer",
                    city: toCity,
                    setCity: setToCity,
                    pay: toPay,
                    setPay: setToPay,
                    bg: "#FFE3EA",
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    style={{ background: f.bg }}
                    className="rounded-2xl border-2 border-[#1B1340] p-3 shadow-[3px_3px_0_0_#1B1340]"
                  >
                    <p className="mb-2 text-base font-extrabold">{f.title}</p>
                    <label className="text-xs font-semibold text-[#1B1340]/70">
                      City
                    </label>
                    <select
                      value={f.city}
                      onChange={(e) => f.setCity(e.target.value)}
                      className={`${field} mb-2`}
                    >
                      {cities.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <label className="text-xs font-semibold text-[#1B1340]/70">
                      {payMode === "gross"
                        ? "Gross monthly salary (₱)"
                        : "Monthly take-home (₱)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={f.pay}
                      onChange={(e) => f.setPay(Number(e.target.value) || 0)}
                      className={field}
                    />
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
                      <div className="flex justify-between">
                        <span>SSS</span>
                        <span>−{peso(p.sss)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PhilHealth</span>
                        <span>−{peso(p.philhealth)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Pag-IBIG</span>
                        <span>−{peso(p.pagibig)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Income tax</span>
                        <span>−{peso(p.tax)}</span>
                      </div>
                      <div className="mt-1 flex justify-between border-t-2 border-[#1B1340] pt-1 font-extrabold">
                        <span>Take-home</span>
                        <span>{peso(p.net)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div
                className="mt-4 rounded-2xl border-2 border-[#1B1340] bg-[#1B1340] p-5 text-white shadow-[4px_4px_0_0_#A78BFA]"
                aria-live="polite"
              >
                <div
                  className={`text-5xl font-black ${diff >= 0 ? "text-[#BEF264]" : "text-[#FF8FA3]"}`}
                >
                  {diff >= 0 ? "+" : "−"}
                  {peso(Math.abs(diff))}
                </div>
                <p className="mt-2 text-sm font-semibold">
                  {diff >= 0 ? "More" : "Less"} left over each month after taxes
                  and living costs if you take the offer.
                </p>
                <p className="mt-2 text-xs text-white/60">
                  Now: {peso(leftNow)} left ({peso(fromTakeHome)} take-home,{" "}
                  {peso(nowCost)} costs). Offer: {peso(leftOffer)} left (
                  {peso(toTakeHome)} take-home, {peso(offerCost)} costs).
                </p>
              </div>

              {payMode === "gross" && (
                <p className="mt-3 text-xs font-semibold text-[#1B1340]/60">
                  Estimate for a regular employee on basic monthly pay. It
                  excludes the 13th-month pay, bonuses, allowances, and HMO.
                  Your payslip may differ slightly.
                </p>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
