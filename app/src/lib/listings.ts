import type { Project } from "@/types/data";

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

export type FloodLevel = "none" | "low" | "medium" | "high";

/** Project NOAH 100-year flood map levels, by expected flood depth. */
export const FLOOD_LABEL: Record<FloodLevel, string> = {
  none: "Outside mapped flood zones",
  low: "Low flood risk (up to 0.5 m)",
  medium: "Medium flood risk (0.5–1.5 m)",
  high: "High flood risk (over 1.5 m)",
};

export type LiquefactionLevel = "none" | "low" | "moderate" | "high";

/** PHIVOLCS liquefaction potential: how likely the ground turns soft in a strong quake. */
export const LIQUEFACTION_LABEL: Record<LiquefactionLevel, string> = {
  none: "Outside mapped liquefaction zones",
  low: "Low liquefaction potential",
  moderate: "Moderate liquefaction potential",
  high: "High liquefaction potential",
};

/** One shape for everything on the map, whatever its type. */
export type Listing = {
  id: string;
  name: string;
  developer: string;
  kind: Kind;
  city: string;
  address: string | null;
  lat: number;
  lng: number;
  /** Cheapest and dearest unit in the project, if the developer publishes prices. */
  priceLow: number | null;
  priceHigh: number | null;
  /** Advertised starting monthly payment, if that's all that's published. */
  monthlyFrom: number | null;
  priceText: string | null;
  sizeLow: number | null;
  sizeHigh: number | null;
  status: "ready" | "preselling" | null;
  turnover: string | null;
  image: string | null;
  url: string;
  scrapedAt: string;
  /** "verified" (developer price list), "scraped" (asking price on their site), or "none". */
  priceSource: Project["price_source"];
  priceAsOf: string | null;
  priceNote: string | null;
  floodLevel: FloodLevel;
  liquefactionLevel: LiquefactionLevel;
};

export function fromProject(p: Project): Listing {
  return {
    id: p.id,
    name: p.name,
    developer: p.developer,
    kind: p.property_type,
    city: p.city,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    priceLow: p.price_low,
    priceHigh: p.price_high,
    monthlyFrom: p.monthly_from,
    priceText: p.price_text,
    sizeLow: p.size_low_sqm,
    sizeHigh: p.size_high_sqm,
    status: p.status,
    turnover: p.turnover,
    image: p.image_url,
    url: p.source_url,
    scrapedAt: p.scraped_at,
    priceSource: p.price_source,
    priceAsOf: p.price_as_of,
    priceNote: p.price_note,
    floodLevel: p.flood_level,
    liquefactionLevel: p.liquefaction_level,
  };
}
