/** Indian rupees: omit .00, retain actual paise. Shared with the editor. */
export function formatINR(val: number | string | undefined): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(Number(val) || 0);
}
