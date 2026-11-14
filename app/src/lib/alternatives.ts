// Philippine alternatives to buying: where the same money could go instead.
// Returns are yearly, after tax and fees, as rates (0.05 = 5%). They're rough
// ranges for a first look, not forecasts. Sources are in docs/sources.md;
// review them each year when MP2 dividends and RTB coupons are announced.

import type { Profile } from "./risk";
import { pct } from "./format";
import {
  rentVsBuy,
  type RentVsBuyAssumptions,
  type RentVsBuyResult,
} from "./mortgage";

export type AlternativeId =
  "mp2" | "rtb" | "time-deposit" | "mix" | "reit" | "index-fund";

export type ReturnRange = {
  /** A poor stretch, e.g. a flat decade for stocks or lower rates on reinvestment. */
  low: number;
  expected: number;
  high: number;
};

export type Alternative = {
  id: AlternativeId;
  label: string;
  emoji: string;
  blurb: string;
  returns: ReturnRange;
  /** Years the money is locked in; 0 if you can take it out any time. */
  lockInYears: number;
  tax: string;
};

const MP2: ReturnRange = { low: 0.06, expected: 0.068, high: 0.072 };
const INDEX_FUND: ReturnRange = { low: 0, expected: 0.06, high: 0.1 };

export const ALTERNATIVES: Record<AlternativeId, Alternative> = {
  mp2: {
    id: "mp2",
    label: "Pag-IBIG MP2",
    emoji: "🏦",
    blurb: "Government-backed, tax-free.",
    returns: MP2,
    lockInYears: 5,
    tax: "Tax-free",
  },
  rtb: {
    id: "rtb",
    label: "Treasury bonds (RTB)",
    emoji: "📜",
    blurb: "Government bonds, from ₱5,000.",
    returns: { low: 0.04, expected: 0.05, high: 0.055 },
    lockInYears: 0,
    tax: "20% final tax on interest",
  },
  "time-deposit": {
    id: "time-deposit",
    label: "Time deposit",
    emoji: "🐷",
    blurb: "Insured up to ₱1M per bank.",
    returns: { low: 0.01, expected: 0.03, high: 0.04 },
    lockInYears: 0,
    tax: "20% final tax on interest",
  },
  mix: {
    id: "mix",
    label: "Half MP2, half index fund",
    emoji: "⚖️",
    blurb: "Steady half, growth half.",
    returns: blend(MP2, INDEX_FUND, 0.5),
    lockInYears: 5,
    tax: "MP2 tax-free; 10% on stock dividends",
  },
  reit: {
    id: "reit",
    label: "PH REITs",
    emoji: "🏢",
    blurb: "Own a slice of offices and malls.",
    returns: { low: 0.01, expected: 0.06, high: 0.09 },
    lockInYears: 0,
    tax: "10% final tax on dividends",
  },
  "index-fund": {
    id: "index-fund",
    label: "PSEi index fund",
    emoji: "📈",
    blurb: "Top 30 PH companies. Flat lately.",
    returns: INDEX_FUND,
    lockInYears: 0,
    tax: "10% on dividends; fees about 1%/yr",
  },
};

export const ALTERNATIVE_IDS = Object.keys(ALTERNATIVES) as AlternativeId[];

/** What each risk appetite compares buying against by default. */
export const PROFILE_ALTERNATIVE: Record<Profile, AlternativeId> = {
  conservative: "mp2",
  balanced: "mix",
  aggressive: "index-fund",
};

/** Mixes two return ranges, `w` of the first and the rest of the second. */
export function blend(a: ReturnRange, b: ReturnRange, w: number): ReturnRange {
  const mix = (x: number, y: number) => x * w + y * (1 - w);
  return {
    low: mix(a.low, b.low),
    expected: mix(a.expected, b.expected),
    high: mix(a.high, b.high),
  };
}

/** Whether the range is wide enough that showing good and bad cases matters. */
export function isVolatile(r: ReturnRange): boolean {
  return r.high - r.low >= 0.02;
}

export type RentVsBuyScenarios = {
  expected: RentVsBuyResult;
  /** Investments do poorly, which favors buying. */
  low: RentVsBuyResult;
  /** Investments do well, which favors renting. */
  high: RentVsBuyResult;
};

/**
 * Runs rent vs buy at the low, expected, and high return of an alternative.
 * The same return applies to whatever the buyer invests too, so it's a fair
 * comparison of where the money sits, not a guess at timing.
 */
export function rentVsBuyScenarios(
  opts: Parameters<typeof rentVsBuy>[0],
  returns: ReturnRange,
): RentVsBuyScenarios {
  const run = (investReturn: number) =>
    rentVsBuy({
      ...opts,
      assumptions: {
        ...opts.assumptions,
        investReturn,
      } satisfies Partial<RentVsBuyAssumptions>,
    });
  return {
    expected: run(returns.expected),
    low: run(returns.low),
    high: run(returns.high),
  };
}

/**
 * One plain sentence on the main reason buying or renting comes out ahead.
 * The key comparison is how much a year of rent is next to the price (rent
 * yield) versus what the loan charges in interest.
 */
export function rentVsBuyReason(opts: {
  price: number;
  monthlyRent: number;
  loanRate: number;
  appreciation: number;
  investReturn: number;
  investLabel: string;
  advantage: number;
}): string {
  const { price, monthlyRent, loanRate, appreciation, investReturn } = opts;
  const rentYield = price > 0 ? (monthlyRent * 12) / price : 0;
  const vs = `(${pct(rentYield)} of the price a year vs ${pct(loanRate)} loan interest)`;
  const cheapRent = rentYield < loanRate;

  if (opts.advantage < 0)
    return cheapRent
      ? `Rent is cheap here ${vs}.`
      : `${opts.investLabel} grows faster (${pct(investReturn)}/yr) than the property (${pct(appreciation)}/yr).`;
  return cheapRent
    ? `The property grows ${pct(appreciation)}/yr while you pay down the loan.`
    : `Rent is expensive here ${vs}.`;
}
