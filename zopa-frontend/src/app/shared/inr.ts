/** Compact rupees for headline figures: lakh and crore, as the rest of the app reads them. */
export function inr(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(1)}L`;
  return `${sign}₹${Math.round(abs).toLocaleString('en-IN')}`;
}
