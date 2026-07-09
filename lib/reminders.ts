export function computeReminderDates(opts: { now: Date; hour: number; minute: number; loggedToday: boolean; days?: number }): Date[] {
  const { now, hour, minute, loggedToday, days = 7 } = opts;
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (loggedToday || first <= now) first.setDate(first.getDate() + 1);
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    dates.push(d);
  }
  return dates;
}
