import { z } from "zod";
import costsRaw from "../../data/costs.json";
import condosRaw from "../../data/condos.json";
import { CostRow, Condo } from "../types/data";

export const costs = z.array(CostRow).parse(costsRaw);
export const condos = z.array(Condo).parse(condosRaw);

export const cities = [...new Set(costs.map((r) => r.city))];
