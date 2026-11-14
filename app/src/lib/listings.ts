import type { Condo, Property } from "../types/data";

export const KINDS = ["condo", "townhouse", "house-and-lot", "lot"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  condo: "Condo",
  townhouse: "Townhouse",
  "house-and-lot": "House & lot",
  lot: "Lot",
};

export const KIND_EMOJI: Record<Kind, string> = {
  condo: "🏙️",
  townhouse: "🏘️",
  "house-and-lot": "🏡",
  lot: "🌳",
};

/** Default condo unit size used for headline prices. */
export const CONDO_SQM = 30;

/** One shape for everything on the map, whatever its type. */
export type Listing = {
  id: string;
  name: string;
  kind: Kind;
  city: string;
  area: string;
  lat: number;
  lng: number;
  /** Condos are priced per sqm of floor area; null for other types. */
  pricePerSqm: number | null;
  /** Midpoint total price (condos: at CONDO_SQM). */
  price: number;
  floorArea: number | null;
  lotArea: number | null;
  rentMonthly: number | null;
  status: "ready" | "preselling" | null;
  source: string;
  asOf: string;
  image: { url: string; credit: string | null; license: string | null } | null;
};

export function fromCondo(c: Condo): Listing {
  const ppsqm = ((c.price_per_sqm_low ?? 0) + (c.price_per_sqm_high ?? 0)) / 2;
  return {
    id: c.id,
    name: c.name,
    kind: "condo",
    city: c.city,
    area: c.area,
    lat: c.lat,
    lng: c.lng,
    pricePerSqm: ppsqm,
    price: ppsqm * CONDO_SQM,
    floorArea: CONDO_SQM,
    lotArea: null,
    rentMonthly: c.rent_1br_monthly,
    status: c.turnover_status,
    source: c.source,
    asOf: c.as_of_date,
    image: c.image_url
      ? { url: c.image_url, credit: c.image_credit, license: c.image_license }
      : null,
  };
}

export function fromProperty(p: Property): Listing {
  return {
    id: p.id,
    name: p.name,
    kind: p.property_type,
    city: p.city,
    area: p.area,
    lat: p.lat,
    lng: p.lng,
    pricePerSqm: null,
    price: (p.price_low + p.price_high) / 2,
    floorArea: p.floor_area_sqm,
    lotArea: p.lot_area_sqm,
    rentMonthly: p.rent_monthly,
    status: p.turnover_status,
    source: p.source,
    asOf: p.as_of_date,
    image: null,
  };
}

/** Gross rental yield in %, or null if the listing has no rent figure. */
export function grossYield(l: Listing): number | null {
  return l.rentMonthly && l.price > 0
    ? ((l.rentMonthly * 12) / l.price) * 100
    : null;
}
