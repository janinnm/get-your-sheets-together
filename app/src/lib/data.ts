import { z } from "zod";
import costsRaw from "../../data/costs.json";
import condosRaw from "../../data/condos.json";
import propertiesRaw from "../../data/properties.json";
import { CostRow, Condo, Property } from "../types/data";
import { fromCondo, fromProperty, type Listing } from "./listings";

export const costs = z.array(CostRow).parse(costsRaw);

export const listings: Listing[] = [
  ...z.array(Condo).parse(condosRaw).map(fromCondo),
  ...z.array(Property).parse(propertiesRaw).map(fromProperty),
];
