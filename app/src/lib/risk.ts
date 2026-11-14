// Risk appetite and property-type defaults. These are rough Philippine market
// norms for a first estimate, not bank quotes. Review them as rules change.

import type { Kind, Listing } from "./listings";
import { peso } from "./format";
import type { Affordability, ShockRow, Verdict } from "./mortgage";

export type Profile = "conservative" | "balanced" | "aggressive";

export type ProfileRules = {
  label: string;
  blurb: string;
  /** Max share of gross income for the amortization. */
  maxDti: number;
  /** Share of take-home that must be left over each month. */
  buffers: { comfortable: number; tight: number };
  /** Months of living + ownership costs to keep in savings after buying. */
  emergencyMonths: number;
  /** Rate rise (percentage points) the budget must survive after the fixed period. */
  mustSurviveShockPct: number;
};

export const PROFILES: Record<Profile, ProfileRules> = {
  conservative: {
    label: "Play it safe",
    blurb: "Low debt, big cushion, no surprises.",
    maxDti: 0.3,
    buffers: { comfortable: 0.25, tight: 0.1 },
    emergencyMonths: 6,
    mustSurviveShockPct: 3,
  },
  balanced: {
    label: "Balanced",
    blurb: "Typical bank limits with a reasonable cushion.",
    maxDti: 0.35,
    buffers: { comfortable: 0.15, tight: 0.05 },
    emergencyMonths: 3,
    mustSurviveShockPct: 2,
  },
  aggressive: {
    label: "Go for growth",
    blurb: "Stretch now for a bigger asset later.",
    maxDti: 0.4,
    buffers: { comfortable: 0.08, tight: 0.02 },
    emergencyMonths: 1,
    mustSurviveShockPct: 1,
  },
};

export type KindDefaults = {
  downPaymentPct: number; // %
  years: number;
  maxYears: number;
  /** Extra interest banks usually charge vs a home loan (percentage points). */
  rateBumpPct: number;
  /** Monthly dues: per sqm of floor area for condos, flat otherwise. */
  duesPerSqm: number;
  duesFlat: number;
  /** Real property tax + maintenance, as a share of price per year. */
  upkeepRate: number;
  appreciationPct: number;
  /** Whether owning it means you no longer pay rent. */
  housesYou: boolean;
};

const RPT = 0.0025; // ~2% of assessed value, which is often ~10–20% of market price

export const KIND_DEFAULTS: Record<Kind, KindDefaults> = {
  condo: {
    downPaymentPct: 20,
    years: 20,
    maxYears: 25,
    rateBumpPct: 0,
    duesPerSqm: 100,
    duesFlat: 0,
    upkeepRate: RPT, // building upkeep is in the dues
    appreciationPct: 3,
    housesYou: true,
  },
  townhouse: {
    downPaymentPct: 20,
    years: 20,
    maxYears: 30,
    rateBumpPct: 0,
    duesPerSqm: 0,
    duesFlat: 1_500,
    upkeepRate: RPT + 0.0075,
    appreciationPct: 4,
    housesYou: true,
  },
  "house-and-lot": {
    downPaymentPct: 20,
    years: 20,
    maxYears: 30,
    rateBumpPct: 0,
    duesPerSqm: 0,
    duesFlat: 2_000,
    upkeepRate: RPT + 0.01,
    appreciationPct: 4,
    housesYou: true,
  },
  lot: {
    downPaymentPct: 30,
    years: 10,
    maxYears: 15,
    rateBumpPct: 1,
    duesPerSqm: 0,
    duesFlat: 500,
    upkeepRate: RPT,
    appreciationPct: 5,
    housesYou: false,
  },
};

export function monthlyUpkeep(kind: Kind, price: number): number {
  return (price * KIND_DEFAULTS[kind].upkeepRate) / 12;
}

export type Flag = { level: "high" | "medium" | "info"; text: string };

export function riskFlags(opts: {
  listing: Listing;
  profile: Profile;
  result: Affordability;
  shockRows: ShockRow[];
  fixedYears: number;
  loanYears: number;
}): Flag[] {
  const {
    listing: l,
    profile,
    result: r,
    shockRows,
    fixedYears,
    loanYears,
  } = opts;
  const rules = PROFILES[profile];
  const safe = profile === "conservative";
  const flags: Flag[] = [];

  // Cash and reserves
  if (r.savingsAfter !== null) {
    if (r.savingsAfter < 0)
      flags.push({
        level: "high",
        text: `You're short ${peso(-r.savingsAfter)} for the down payment and closing costs.`,
      });
    else if (r.savingsAfter < r.emergencyTarget)
      flags.push({
        level: safe ? "high" : "medium",
        text: `After paying upfront you'd have ${peso(r.savingsAfter)} left, under the ${rules.emergencyMonths}-month emergency fund (${peso(r.emergencyTarget)}) your profile wants.`,
      });
  }

  // Rate reset
  const yearsLeft = loanYears - fixedYears;
  const must = shockRows.find((s) => s.shockPct === rules.mustSurviveShockPct);
  if (yearsLeft > 0 && must && (must.leftover < 0 || !must.qualifies))
    flags.push({
      level: "high",
      text: `If rates rise ${rules.mustSurviveShockPct} points after year ${fixedYears}, the payment would be ${peso(must.newPayment)}. That's beyond what your profile tolerates.`,
    });

  // Type-specific
  if (l.status === "preselling")
    flags.push({
      level: safe ? "high" : "medium",
      text: "Preselling: you pay the down payment during construction while still paying rent, and turnover delays of a year or more are common.",
    });

  if (l.kind === "lot")
    flags.push({
      level: safe ? "high" : "medium",
      text: "A lot earns nothing and doesn't house you, so you keep paying rent too. Banks lend less for lots, and they can take long to resell. Building on it is a separate cost.",
    });
  if (l.kind === "condo")
    flags.push({
      level: "info",
      text: "Condo dues and special assessments can rise, and resale competes with new towers nearby.",
    });
  if (l.kind === "house-and-lot" || l.kind === "townhouse")
    flags.push({
      level: "info",
      text: "All repairs are on you: roof, plumbing, waterproofing. Check the area's flood history before buying.",
    });

  if (l.priceLow === null)
    flags.push({
      level: "info",
      text: `${l.developer} doesn't publish prices for ${l.name}, so this uses the price you entered. Ask for a quote with the exact unit, floor, and payment terms.`,
    });
  else if (l.priceHigh !== null && l.priceHigh > l.priceLow)
    flags.push({
      level: "info",
      text: `${l.developer} lists ${l.name} at ${peso(l.priceLow)} to ${peso(l.priceHigh)}. The low end is usually the smallest unit on a lower floor, so get a quote for the unit you want.`,
    });

  const order = { high: 0, medium: 1, info: 2 };
  return flags.sort((a, b) => order[a.level] - order[b.level]);
}

/** A high-level flag is a deal-breaker for the chosen profile, so it caps the verdict at "stretch". */
export function finalVerdict(verdict: Verdict, flags: Flag[]): Verdict {
  const hasHigh = flags.some((f) => f.level === "high");
  return hasHigh && (verdict === "comfortable" || verdict === "tight")
    ? "stretch"
    : verdict;
}
