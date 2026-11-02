// All amounts are integer cents in USD. These helpers are the only place that
// converts between cents and the strings PayPal / the UI need.

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

/** "47.80" — the exact string format PayPal expects for amount.value */
export function centsToPayPalValue(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`invalid cents: ${cents}`);
  return (cents / 100).toFixed(2);
}

/** "$47.80" for the UI */
export function formatUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${rem.toString().padStart(2, "0")}`;
}

export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? Number.parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) throw new Error(`invalid dollars: ${dollars}`);
  return Math.round(n * 100);
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** price / reference, rounded to 1 decimal ("2.8×") */
export function priceRatio(priceCents: number, referenceCents: number): number {
  if (referenceCents <= 0) return 1;
  return Math.round((priceCents / referenceCents) * 10) / 10;
}
