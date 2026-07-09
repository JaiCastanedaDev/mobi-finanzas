export function formatCOP(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${grouped}`;
}

export function parseAmount(text: string): number {
  const clean = text.trim();
  if (/^\d+$/.test(clean)) return parseInt(clean, 10);
  if (/^\d{1,3}(\.\d{3})+$/.test(clean)) return parseInt(clean.replace(/\./g, ''), 10);
  return NaN;
}
