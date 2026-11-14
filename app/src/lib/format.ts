export const peso = (n: number) => "₱" + Math.round(n).toLocaleString("en-PH");

/** Compact millions, e.g. ₱5.3M. */
export const short = (n: number) =>
  !isFinite(n) ? "No limit" : `₱${(n / 1_000_000).toFixed(1)}M`;
