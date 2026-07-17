import { describe, expect, it } from 'vitest';
import { addDaysISO, lastNMonths, monthLabel, monthOf, monthsBetween, nextDateForDay, shiftMonth, todayISO, yesterdayOf } from '../lib/dates';

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

describe('monthsBetween', () => {
  it('cuenta meses entre dos year-month', () => {
    expect(monthsBetween('2026-07', '2026-12')).toBe(5);
    expect(monthsBetween('2026-07', '2026-07')).toBe(0);
    expect(monthsBetween('2026-07', '2026-06')).toBe(-1);
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
  });
  it('ignora el día si recibe fechas completas', () => {
    expect(monthsBetween('2026-07-31', '2026-09-01')).toBe(2);
  });
});

describe('nextDateForDay', () => {
  it('día futuro dentro del mes actual', () => {
    expect(nextDateForDay(20, '2026-07-17')).toBe('2026-07-20');
  });
  it('día = hoy → hoy', () => {
    expect(nextDateForDay(17, '2026-07-17')).toBe('2026-07-17');
  });
  it('día ya pasado → mes siguiente', () => {
    expect(nextDateForDay(5, '2026-07-17')).toBe('2026-08-05');
  });
  it('clamp al último día en meses cortos', () => {
    expect(nextDateForDay(31, '2026-02-10')).toBe('2026-02-28');
  });
  it('cruce de año en diciembre', () => {
    expect(nextDateForDay(5, '2026-12-10')).toBe('2027-01-05');
  });
});
