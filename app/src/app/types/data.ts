import { z } from "zod";

export const CostRow = z.object({
  city: z.string(),
  area: z.string().nullable(),
  category: z.enum(["rent", "utilities", "transport", "food"]),
  item: z.string(),
  value: z.number().nonnegative(),
  unit: z.string(),
  source: z.string(),
  source_url: z.string().nullable(),
  as_of_date: z.string(),
});

export const Condo = z.object({
  id: z.string(),
  name: z.string(),
  developer: z.string().nullable(),
  city: z.string(),
  area: z.string(),
  lat: z.number(),
  lng: z.number(),
  price_per_sqm_low: z.number().nullable(),
  price_per_sqm_high: z.number().nullable(),
  rent_1br_monthly: z.number().nullable(),
  turnover_status: z.enum(["ready", "preselling"]).nullable(),
  source: z.string(),
  as_of_date: z.string(),
});

export type CostRow = z.infer<typeof CostRow>;
export type Condo = z.infer<typeof Condo>;
