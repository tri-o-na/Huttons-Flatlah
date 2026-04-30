export function formatCurrency(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPsf(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return 'N/A';
  return `SGD ${value.toFixed(2)} psf`;
}