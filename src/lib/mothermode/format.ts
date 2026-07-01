/** Format a cents amount as a plain USD string, e.g. 2700 -> "$27". */
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

/** Parse a display price like "$4.97" or "$27" into integer cents. */
export function parsePriceToCents(price: string): number {
  const n = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
