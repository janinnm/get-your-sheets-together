// Home-loan affordability for Philippine condo purchases.
// Defaults are rough market norms; review them whenever bank or Pag-IBIG rates change.

/** Max share of gross monthly income a lender lets go to the amortization. Banks and Pag-IBIG typically use 30–35%. */
export const DEFAULT_MAX_DTI = 0.35;
/** One-off buyer costs on top of the down payment: transfer tax, DST, registration, notarial and move-in fees. Roughly 5–8% of price. */
export const DEFAULT_CLOSING_COST_RATE = 0.06;

export type LoanTerms = {
  price: number;
  downPaymentPct: number; // 0–1
  annualRate: number; // 0–1, e.g. 0.065
  years: number;
};

export type LoanResult = {
  price: number;
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  totalInterest: number;
};

/** Standard amortizing-loan payment. Handles a 0% rate. */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  years: number,
): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

/** Inverse of monthlyPayment: the loan a given payment can support. */
export function principalFor(
  payment: number,
  annualRate: number,
  years: number,
): number {
  const n = Math.round(years * 12);
  if (payment <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return payment * n;
  return (payment * (1 - Math.pow(1 + r, -n))) / r;
}

export function loan(t: LoanTerms): LoanResult {
  const dp = clamp01(t.downPaymentPct);
  const downPayment = t.price * dp;
  const loanAmount = t.price - downPayment;
  const pay = monthlyPayment(loanAmount, t.annualRate, t.years);
  return {
    price: t.price,
    downPayment,
    loanAmount,
    monthlyPayment: pay,
    totalInterest: Math.max(0, pay * Math.round(t.years * 12) - loanAmount),
  };
}

/** Gross monthly income a lender would require for this payment. */
export function requiredGrossIncome(
  payment: number,
  maxDti: number = DEFAULT_MAX_DTI,
): number {
  return maxDti > 0 ? payment / maxDti : Infinity;
}

/** Highest property price a gross income can qualify for under the given terms. */
export function maxAffordablePrice(
  grossMonthly: number,
  t: Omit<LoanTerms, "price">,
  maxDti: number = DEFAULT_MAX_DTI,
): number {
  const loanCap = principalFor(grossMonthly * maxDti, t.annualRate, t.years);
  const dp = clamp01(t.downPaymentPct);
  return dp >= 1 ? Infinity : loanCap / (1 - dp);
}

export type Verdict = "comfortable" | "tight" | "stretch" | "not-yet";

export type Affordability = LoanResult & {
  upfrontCash: number; // down payment + closing costs
  monthlyOwnership: number; // amortization + dues and other ownership costs
  requiredGross: number;
  qualifies: boolean; // passes the lender's DTI check
  leftover: number; // net pay − living costs − ownership costs
  /** Savings left after paying upfront cash; null if savings weren't given. */
  savingsAfter: number | null;
  /** Emergency fund wanted after the purchase (months × monthly outflow). */
  emergencyTarget: number;
  verdict: Verdict;
};

export function assess(opts: {
  terms: LoanTerms;
  grossMonthly: number;
  netMonthly: number;
  /** Everything you'd still pay each month besides the loan: utilities, transport, food, and rent if the property doesn't house you. */
  livingCosts: number;
  /** Dues, real property tax, maintenance: any monthly ownership cost besides the loan. */
  otherOwnershipCosts?: number;
  closingCostRate?: number;
  maxDti?: number;
  /** Share of take-home that must be left over to count as comfortable / tight. */
  buffers?: { comfortable: number; tight: number };
  savings?: number;
  emergencyMonths?: number;
}): Affordability {
  const {
    terms,
    grossMonthly,
    netMonthly,
    livingCosts,
    otherOwnershipCosts = 0,
    closingCostRate = DEFAULT_CLOSING_COST_RATE,
    maxDti = DEFAULT_MAX_DTI,
    buffers = { comfortable: 0.15, tight: 0.05 },
    savings,
    emergencyMonths = 0,
  } = opts;

  const l = loan(terms);
  const requiredGross = requiredGrossIncome(l.monthlyPayment, maxDti);
  const qualifies = grossMonthly >= requiredGross;
  const monthlyOwnership = l.monthlyPayment + otherOwnershipCosts;
  const leftover = netMonthly - livingCosts - monthlyOwnership;
  const upfrontCash = l.downPayment + terms.price * closingCostRate;
  const savingsAfter = savings === undefined ? null : savings - upfrontCash;
  const emergencyTarget = emergencyMonths * (livingCosts + monthlyOwnership);

  const buffer = netMonthly > 0 ? leftover / netMonthly : -1;
  const cantPayUpfront = savingsAfter !== null && savingsAfter < 0;
  const thinReserves = savingsAfter !== null && savingsAfter < emergencyTarget;

  const verdict: Verdict =
    leftover < 0 || cantPayUpfront
      ? "not-yet"
      : !qualifies || thinReserves || buffer < buffers.tight
        ? "stretch"
        : buffer >= buffers.comfortable
          ? "comfortable"
          : "tight";

  return {
    ...l,
    upfrontCash,
    monthlyOwnership,
    requiredGross,
    qualifies,
    leftover,
    savingsAfter,
    emergencyTarget,
    verdict,
  };
}

/** Loan balance left after `months` payments. */
export function remainingBalance(
  principal: number,
  annualRate: number,
  years: number,
  months: number,
): number {
  const n = Math.round(years * 12);
  const k = Math.min(Math.max(0, Math.round(months)), n);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRate / 12;
  const pay = monthlyPayment(principal, annualRate, years);
  if (r === 0) return Math.max(0, principal - pay * k);
  const g = Math.pow(1 + r, k);
  return Math.max(0, principal * g - (pay * (g - 1)) / r);
}

// ---------- Rate-shock stress test ----------

export type ShockRow = {
  shockPct: number; // percentage points added, e.g. 2 = +2pp
  newRate: number;
  newPayment: number;
  increase: number; // vs the original payment
  leftover: number;
  qualifies: boolean;
};

/**
 * Philippine bank loans are usually fixed for 1–10 years, then reprice to the
 * market rate. This recomputes the payment on the remaining balance and term
 * at the original rate plus each shock.
 */
export function rateShock(opts: {
  terms: LoanTerms;
  fixedYears: number;
  shocksPct?: number[];
  grossMonthly: number;
  netMonthly: number;
  livingCosts: number;
  otherOwnershipCosts?: number;
  maxDti?: number;
}): { balanceAtReset: number; yearsLeft: number; rows: ShockRow[] } {
  const {
    terms,
    shocksPct = [1, 2, 3],
    grossMonthly,
    netMonthly,
    livingCosts,
    otherOwnershipCosts = 0,
    maxDti = DEFAULT_MAX_DTI,
  } = opts;
  const base = loan(terms);
  const fixedYears = Math.min(Math.max(0, opts.fixedYears), terms.years);
  const yearsLeft = terms.years - fixedYears;
  const balanceAtReset = remainingBalance(
    base.loanAmount,
    terms.annualRate,
    terms.years,
    fixedYears * 12,
  );

  const rows = shocksPct.map((shockPct) => {
    const newRate = terms.annualRate + shockPct / 100;
    const newPayment =
      yearsLeft > 0 ? monthlyPayment(balanceAtReset, newRate, yearsLeft) : 0;
    return {
      shockPct,
      newRate,
      newPayment,
      increase: newPayment - base.monthlyPayment,
      leftover: netMonthly - livingCosts - otherOwnershipCosts - newPayment,
      qualifies: newPayment <= grossMonthly * maxDti,
    };
  });
  return { balanceAtReset, yearsLeft, rows };
}

// ---------- Rent vs buy ----------

export type RentVsBuyAssumptions = {
  horizonYears: number;
  appreciation: number; // property value growth per year, 0–1
  rentGrowth: number; // rent increase per year, 0–1
  investReturn: number; // return on cash not tied up in the property, 0–1
  sellingCostRate: number; // broker fee + capital gains tax etc. on sale, 0–1
};

/**
 * A year of rent for a similar place, as a share of its price. Rule of thumb
 * for Metro Manila (gross yields are often quoted at 4–6%) until there's real
 * rental data. Used only to default the rent in the rent vs buy comparison.
 */
export const DEFAULT_RENT_YIELD = 0.05;

/** Rent for a place like this one, rounded to the nearest ₱500. */
export function similarRent(price: number, yieldRate = DEFAULT_RENT_YIELD) {
  return Math.round((price * yieldRate) / 12 / 500) * 500;
}

export const DEFAULT_RENT_VS_BUY: RentVsBuyAssumptions = {
  horizonYears: 10,
  appreciation: 0.03,
  rentGrowth: 0.04,
  investReturn: 0.05,
  sellingCostRate: 0.1, // ~6% CGT + ~3–5% broker
};

export type RentVsBuyYear = {
  year: number;
  buyerNetWorth: number; // home equity after selling costs + buyer's investments
  renterNetWorth: number; // renter's investments
};

export type RentVsBuyResult = {
  years: RentVsBuyYear[];
  breakEvenYear: number | null; // first year buying comes out ahead
  advantage: number; // buyer − renter at the horizon (positive = buy wins)
  /** The pieces behind the totals, so the result can be explained step by step. */
  breakdown: {
    upfront: number; // down payment + closing costs (the renter invests this instead)
    ownCostStart: number; // loan + dues and upkeep in the first month
    rentStart: number;
    propertyValue: number; // at the horizon
    sellingCosts: number;
    loanLeft: number;
    buyerInvestments: number; // what the buyer invested when rent cost more
    renterInvestments: number;
    /** What the renter invests each month (owning cost − rent), first and last month. */
    renterMonthlyStart: number;
    renterMonthlyEnd: number;
    /** Everything the renter put in: the upfront cash plus every monthly amount. */
    renterPaidIn: number;
  };
};

/**
 * Compares net worth of buying vs renting a similar unit. Both start with the
 * same cash: the buyer spends it on the down payment and closing costs, the
 * renter invests it. Each month whoever pays less invests the difference.
 */
export function rentVsBuy(opts: {
  terms: LoanTerms;
  monthlyRent: number;
  otherOwnershipCosts?: number;
  closingCostRate?: number;
  assumptions?: Partial<RentVsBuyAssumptions>;
}): RentVsBuyResult {
  const a = { ...DEFAULT_RENT_VS_BUY, ...opts.assumptions };
  const { terms, monthlyRent, otherOwnershipCosts = 0 } = opts;
  const closingCostRate = opts.closingCostRate ?? DEFAULT_CLOSING_COST_RATE;

  const l = loan(terms);
  const upfront = l.downPayment + terms.price * closingCostRate;
  const mInvest = Math.pow(1 + a.investReturn, 1 / 12) - 1;
  const loanMonths = Math.round(terms.years * 12);
  const horizonMonths = Math.round(a.horizonYears * 12);

  let renterPot = upfront;
  let buyerPot = 0;
  let rent = monthlyRent;
  let dues = otherOwnershipCosts;
  const years: RentVsBuyYear[] = [];
  let breakEvenYear: number | null = null;
  let renterPaidIn = upfront;
  const renterMonthly: number[] = [];

  for (let m = 1; m <= horizonMonths; m++) {
    const ownCost = (m <= loanMonths ? l.monthlyPayment : 0) + dues;
    const renterAdds = Math.max(0, ownCost - rent);
    renterMonthly.push(renterAdds);
    renterPaidIn += renterAdds;
    renterPot = renterPot * (1 + mInvest) + renterAdds;
    buyerPot = buyerPot * (1 + mInvest) + Math.max(0, rent - ownCost);

    if (m % 12 === 0) {
      const year = m / 12;
      const value = terms.price * Math.pow(1 + a.appreciation, year);
      const balance = remainingBalance(
        l.loanAmount,
        terms.annualRate,
        terms.years,
        m,
      );
      const buyerNetWorth =
        value * (1 - a.sellingCostRate) - balance + buyerPot;
      years.push({ year, buyerNetWorth, renterNetWorth: renterPot });
      if (breakEvenYear === null && buyerNetWorth >= renterPot)
        breakEvenYear = year;
      rent *= 1 + a.rentGrowth;
      dues *= 1 + a.rentGrowth; // dues tend to rise with inflation too
    }
  }

  const last = years[years.length - 1];
  const propertyValue =
    terms.price * Math.pow(1 + a.appreciation, horizonMonths / 12);
  return {
    years,
    breakEvenYear,
    advantage: last ? last.buyerNetWorth - last.renterNetWorth : 0,
    breakdown: {
      upfront,
      ownCostStart:
        (loanMonths > 0 ? l.monthlyPayment : 0) + otherOwnershipCosts,
      rentStart: monthlyRent,
      propertyValue,
      sellingCosts: propertyValue * a.sellingCostRate,
      loanLeft: remainingBalance(
        l.loanAmount,
        terms.annualRate,
        terms.years,
        horizonMonths,
      ),
      buyerInvestments: buyerPot,
      renterInvestments: renterPot,
      renterMonthlyStart: renterMonthly[0] ?? 0,
      renterMonthlyEnd: renterMonthly[renterMonthly.length - 1] ?? 0,
      renterPaidIn,
    },
  };
}

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
