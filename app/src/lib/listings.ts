import type { Project } from "../types/data";

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
  };
}
