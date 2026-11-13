import type { CostRow } from "../types/data";

const KWH_PER_MONTH = 150; // single-person assumption

export type Breakdown = {
  city: string;
  Rent: number;
  Utilities: number;
  Transport: number;
  Food: number;
};

export const total = (b: Breakdown) =>
  b.Rent + b.Utilities + b.Transport + b.Food;

export function monthlyBreakdown(
  rows: CostRow[],
  city: string,
  rentItem: string = "1BR condo",
): Breakdown {
  const get = (category: string, item: string) =>
    rows.find(
      (r) => r.city === city && r.category === category && r.item === item,
    )?.value ?? 0;

  return {
    city,
    Rent: get("rent", rentItem),
    Utilities:
      get("utilities", "Electricity") * KWH_PER_MONTH +
      get("utilities", "Water") +
      get("utilities", "Internet"),
    Transport: get("transport", "Monthly commute"),
    Food: get("food", "Groceries"),
  };
}
