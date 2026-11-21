export const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");

/** A 0–1 rate as a percent, e.g. 0.068 → "6.8%", 0.05 → "5%". */
export const pct = (rate: number) =>
  `${(rate * 100).toFixed(1).replace(/\.0$/, "")}%`;

/** Rounded for headlines: ₱1.95M, ₱130K, ₱900. */
export const compact = (n: number) => {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1_000_000)
    return `${sign}₱${(a / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (a >= 1_000) return `${sign}₱${Math.round(a / 1_000)}K`;
  return `${sign}₱${Math.round(a)}`;
};

/** Compact millions, e.g. ₱5.3M. */
export const short = (n: number) =>
  !isFinite(n) ? "No limit" : `₱${(n / 1_000_000).toFixed(1)}M`;
