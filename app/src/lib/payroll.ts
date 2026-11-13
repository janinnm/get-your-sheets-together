// Philippine payroll estimate, based on 2026 rules (TRAIN tax table, SSS 15% total, PhilHealth 5%, Pag-IBIG 2%).
// Review these constants whenever rates change.

const SSS_EMPLOYEE_RATE = 0.05;
const SSS_MIN_MSC = 5_000;
const SSS_MAX_MSC = 35_000;

const PHILHEALTH_EMPLOYEE_RATE = 0.025; // half of the 5% premium
const PHILHEALTH_MIN = 10_000;
const PHILHEALTH_MAX = 100_000;

const PAGIBIG_RATE = 0.02;
const PAGIBIG_MAX_FUND_SALARY = 10_000;

// Annual taxable income brackets (TRAIN, effective 2023 onward)
const TAX_BRACKETS = [
  { over: 0, base: 0, rate: 0 },
  { over: 250_000, base: 0, rate: 0.15 },
  { over: 400_000, base: 22_500, rate: 0.2 },
  { over: 800_000, base: 102_500, rate: 0.25 },
  { over: 2_000_000, base: 402_500, rate: 0.3 },
  { over: 8_000_000, base: 2_202_500, rate: 0.35 },
];

export type NetPay = {
  gross: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  tax: number;
  net: number;
};

function annualTax(taxableAnnual: number): number {
  if (taxableAnnual <= 0) return 0;
  const b = [...TAX_BRACKETS].reverse().find((x) => taxableAnnual > x.over)!;
  return b.base + (taxableAnnual - b.over) * b.rate;
}

/** Estimates monthly take-home pay from a monthly gross salary (basic pay, no 13th month or bonuses). */
export function grossToNet(gross: number): NetPay {
  const g = Math.max(0, gross);

  const msc = Math.min(
    SSS_MAX_MSC,
    Math.max(SSS_MIN_MSC, Math.round(g / 500) * 500),
  );
  const sss = g > 0 ? msc * SSS_EMPLOYEE_RATE : 0;

  const philhealth =
    g > 0
      ? Math.min(PHILHEALTH_MAX, Math.max(PHILHEALTH_MIN, g)) *
        PHILHEALTH_EMPLOYEE_RATE
      : 0;

  const pagibig = Math.min(g, PAGIBIG_MAX_FUND_SALARY) * PAGIBIG_RATE;

  const taxableMonthly = g - sss - philhealth - pagibig;
  const tax = annualTax(taxableMonthly * 12) / 12;

  return {
    gross: g,
    sss,
    philhealth,
    pagibig,
    tax,
    net: g - sss - philhealth - pagibig - tax,
  };
}
