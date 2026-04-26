/** LTR-friendly amounts (e.g. 10,000.50 DH) for dashboards and tables. */
export function formatCurrencyDhEn(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} DH`;
}

/** Fintech-style display: always two decimal places (e.g. 15,000.00 DH). */
export function formatCurrencyDhFintech(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} DH`;
}

export function formatNumberEn(n: number, maximumFractionDigits: number = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(n);
}
