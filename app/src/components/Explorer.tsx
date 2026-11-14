"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { setWorkerUrl, type LngLatBounds } from "maplibre-gl";
import Map, {
  Marker,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CostRow } from "../types/data";
import { monthlyBreakdown, total, type RentItem } from "../lib/cost-of-living";
import { short } from "../lib/format";
import { KINDS, KIND_EMOJI, KIND_LABEL, type Listing } from "../lib/listings";
import { INK } from "./ui";
import Logo from "./Logo";
import PropertiesTab, { matches, type Filters } from "./tabs/PropertiesTab";
import CostsTab from "./tabs/CostsTab";
import OfferCheck from "./tabs/OfferCheck";
import BuyCheck from "./tabs/BuyCheck";

setWorkerUrl("/maplibre-gl-worker.mjs");

const STYLE = "https://tiles.openfreemap.org/styles/liberty"; // free, no API key
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

type Tab = "homes" | "costs" | "offer" | "buy";
const TABS: [Tab, string, string][] = [
  ["homes", "Properties", "🏘️"],
  ["costs", "Living costs", "💸"],
  ["offer", "Offer check", "🧮"],
  ["buy", "Can I buy?", "🔑"],
];

export default function Explorer({
  costs,
  listings,
}: {
  costs: CostRow[];
  listings: Listing[];
}) {
  const mapRef = useRef<MapRef>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});

  const [tab, setTab] = useState<Tab>("homes");
  const [rentItem, setRentItem] = useState<RentItem>("1BR condo");
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [bounds, setBounds] = useState<LngLatBounds | null>(null);
  const [filters, setFilters] = useState<Filters>({
    kinds: new Set(KINDS),
    status: "all",
    budget: null,
  });
  const [buyId, setBuyId] = useState(listings[0]?.id ?? "");

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

  const cityCenters = useMemo(() => {
    const out: Record<string, [number, number]> = {};
    for (const city of cities) {
      const ls = listings.filter((l) => l.city === city);
      if (ls.length)
        out[city] = [
          ls.reduce((s, l) => s + l.lng, 0) / ls.length,
          ls.reduce((s, l) => s + l.lat, 0) / ls.length,
        ];
    }
    return out;
  }, [cities, listings]);

  const filtered = useMemo(
    () => listings.filter((l) => matches(l, filters)),
    [listings, filters],
  );
  const visible = useMemo(
    () =>
      bounds
        ? filtered.filter((l) => bounds.contains([l.lng, l.lat]))
        : filtered,
    [bounds, filtered],
  );

  const initialBounds = useMemo(() => {
    const lngs = listings.map((l) => l.lng);
    const lats = listings.map((l) => l.lat);
    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ] as [[number, number], [number, number]];
  }, [listings]);

  const isActive = (id: string) => hovered === id || selected === id;

  function selectListing(l: Listing, fromMap: boolean) {
    setSelected(l.id);
    setTab("homes");
    mapRef.current?.flyTo({ center: [l.lng, l.lat], zoom: 14, duration: 800 });
    if (fromMap)
      setTimeout(
        () =>
          cardRefs.current[l.id]?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          }),
        900,
      );
  }

  function openBuy(l: Listing) {
    setBuyId(l.id);
    setTab("buy");
  }

  function flyToCity(city: string) {
    const center = cityCenters[city];
    if (center) mapRef.current?.flyTo({ center, zoom: 12, duration: 900 });
  }

  // Tabs stay mounted (just hidden) so inputs survive switching tabs.
  const panels: Record<Tab, ReactNode> = {
    homes: (
      <PropertiesTab
        visible={visible}
        filters={filters}
        setFilters={setFilters}
        activeId={isActive}
        setHovered={setHovered}
        onSelect={(l) => selectListing(l, false)}
        onBuy={openBuy}
        cardRefs={cardRefs}
        color={color}
      />
    ),
    costs: (
      <CostsTab
        breakdowns={breakdowns}
        rentItem={rentItem}
        setRentItem={setRentItem}
        color={color}
        onCity={flyToCity}
      />
    ),
    offer: (
      <OfferCheck
        costs={costs}
        cities={cities}
        defaultFrom={breakdowns[0]?.city ?? ""}
        defaultTo={breakdowns[breakdowns.length - 1]?.city ?? ""}
        rentItem={rentItem}
        setRentItem={setRentItem}
      />
    ),
    buy: listings.length > 0 && (
      <BuyCheck
        listings={listings}
        costs={costs}
        listingId={buyId}
        onPick={setBuyId}
      />
    ),
  };

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
          {filtered.map((l) => {
            const active = isActive(l.id);
            return (
              <Marker
                key={l.id}
                longitude={l.lng}
                latitude={l.lat}
                anchor="bottom"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectListing(l, true);
                  }}
                  onMouseEnter={() => setHovered(l.id)}
                  onMouseLeave={() => setHovered(null)}
                  aria-label={`${KIND_LABEL[l.kind]}: ${l.name}, ${short(l.price)}`}
                  style={{ background: active ? INK : color(l.city) }}
                  className={`rounded-full border-2 border-[#1B1340] px-3 py-1 text-sm font-extrabold shadow-[2px_2px_0_0_#1B1340] transition ${
                    active ? "z-10 scale-110 text-white" : "text-[#1B1340]"
                  }`}
                >
                  {KIND_EMOJI[l.kind]} {short(l.price)}
                </button>
              </Marker>
            );
          })}
        </Map>
      </div>

      {/* Floating panel: bottom sheet on mobile, side card on desktop */}
      <aside className="absolute bottom-0 left-0 z-10 flex max-h-[60%] w-full flex-col overflow-hidden rounded-t-3xl border-2 border-[#1B1340] bg-white text-[#1B1340] shadow-[6px_6px_0_0_#1B1340] lg:bottom-4 lg:left-4 lg:top-4 lg:max-h-none lg:w-[540px] lg:rounded-3xl">
        <header className="shrink-0 border-b-2 border-[#1B1340] bg-[#FFC845] px-5 pb-4 pt-5">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <h1 className="text-[1.75rem] font-black leading-tight tracking-tight sm:text-3xl">
              Get your{" "}
              <span className="inline-block -rotate-2 rounded-lg border-2 border-[#1B1340] bg-[#A78BFA] px-1.5 leading-none shadow-[2px_2px_0_0_#1B1340]">
                <span className="relative top-[0.04em]">sheets</span>
              </span>{" "}
              together
            </h1>
          </div>
          <p className="mt-3 text-sm font-semibold text-[#1B1340]/80">
            Condos, houses, and lots across Metro Manila, checked against your
            salary, savings, and appetite for risk.
          </p>
          <p className="mt-2 inline-block rounded-full border-2 border-[#1B1340] bg-white px-2.5 py-0.5 text-[11px] font-bold">
            Sample data · not real prices yet
          </p>

          <div className="mt-4 flex gap-2">
            {TABS.map(([id, label, emoji]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                aria-pressed={tab === id}
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
          {TABS.map(([id]) => (
            <div key={id} hidden={tab !== id}>
              {panels[id]}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
