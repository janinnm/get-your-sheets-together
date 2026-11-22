import { z } from "zod";

/** One real project scraped from a developer's website (see pipelines/scrape_developers.py). */
export const Project = z.object({
  id: z.string(),
  name: z.string(),
  developer: z.string(),
  property_type: z.enum(["condo", "townhouse", "house-and-lot", "lot"]),
  city: z.string(),
  address: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  /** Total price range for the project's units, when the developer publishes one. */
  price_low: z.number().positive().nullable(),
  price_high: z.number().positive().nullable(),
  /** Advertised starting monthly payment, when that's all that's published. */
  monthly_from: z.number().positive().nullable(),
  /** The price exactly as written on the page. */
  price_text: z.string().nullable(),
  size_low_sqm: z.number().positive().nullable(),
  size_high_sqm: z.number().positive().nullable(),
  status: z.enum(["ready", "preselling"]).nullable(),
  turnover: z.string().nullable(),
  image_url: z.string().nullable(),
  source_url: z.string(),
  scraped_at: z.string(),
  /**
   * Where the price came from (set by pipelines/build_projects.py):
   * "verified" a developer price list entered by hand, "scraped" an asking
   * price from the developer's site, "none" nothing published.
   */
  price_source: z.enum(["verified", "scraped", "none"]),
  /** Date of the price: the quote date if verified, else the scrape date. */
  price_as_of: z.string().nullable(),
  /** Where a verified price came from, e.g. "Developer price list, Nov 2026". */
  price_note: z.string().nullable(),
  /** Hazard at the project's location on Project NOAH's 100-year flood map (see pipelines/hazards.py). */
  flood_level: z.enum(["none", "low", "medium", "high"]),
  /** Liquefaction potential at the location on PHIVOLCS's hazard map. */
  liquefaction_level: z.enum(["none", "low", "moderate", "high"]),
});

export type Project = z.infer<typeof Project>;
