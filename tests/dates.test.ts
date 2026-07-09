import { describe, expect, it } from 'vitest';
import { addDaysISO, lastNMonths, monthLabel, monthOf, shiftMonth, todayISO, yesterdayOf } from '../lib/dates';

describe('dates', () => {
  it('todayISO formatea local YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 6, 8))).toBe('2026-07-08');
  });
  it('addDaysISO cruza meses y años', () => {
    expect(addDaysISO('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('yesterdayOf', () => {
    expect(yesterdayOf('2026-07-08')).toBe('2026-07-07');
  });
  it('monthOf y shiftMonth', () => {
    expect(monthOf('2026-07-08')).toBe('2026-07');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('lastNMonths incluye el mes actual al final', () => {
    expect(lastNMonths(3, '2026-01-15')).toEqual(['2025-11', '2025-12', '2026-01']);
  });
  it('monthLabel en español', () => {
    expect(monthLabel('2026-07')).toBe('jul 2026');
  });
});
