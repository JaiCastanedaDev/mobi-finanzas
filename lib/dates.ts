const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

export function yesterdayOf(iso: string): string {
  return addDaysISO(iso, -1);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function lastNMonths(n: number, today: string): string[] {
  const current = monthOf(today);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(current, -i));
  return out;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

export function dayLabel(iso: string, today: string): string {
  if (iso === today) return 'Hoy';
  if (iso === addDaysISO(today, -1)) return 'Ayer';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MESES[m - 1]}`;
}

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function nextDateForDay(day: number, today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const daysIn = (yy: number, mm: number) => new Date(yy, mm, 0).getDate(); // mm 1-based
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const thisClamped = Math.min(day, daysIn(y, m));
  if (thisClamped >= d) return iso(y, m, thisClamped);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return iso(ny, nm, Math.min(day, daysIn(ny, nm)));
}
