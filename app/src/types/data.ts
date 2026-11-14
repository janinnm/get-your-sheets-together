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
});

export type Project = z.infer<typeof Project>;
