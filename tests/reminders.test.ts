import { describe, expect, it } from 'vitest';
import { computeReminderDates } from '../lib/reminders';

describe('computeReminderDates', () => {
  const nineAM = new Date(2026, 6, 8, 9, 0); // 8 jul 2026, 9:00

  it('si no ha registrado y la hora no pasó, la primera es hoy', () => {
    const dates = computeReminderDates({ now: nineAM, hour: 21, minute: 0, loggedToday: false });
    expect(dates).toHaveLength(7);
    expect(dates[0].getDate()).toBe(8);
    expect(dates[0].getHours()).toBe(21);
    expect(dates[6].getDate()).toBe(14);
  });

  it('si ya registró hoy, arranca mañana', () => {
    const dates = computeReminderDates({ now: nineAM, hour: 21, minute: 0, loggedToday: true });
    expect(dates[0].getDate()).toBe(9);
  });

  it('si la hora de hoy ya pasó, arranca mañana', () => {
    const tenPM = new Date(2026, 6, 8, 22, 0);
    const dates = computeReminderDates({ now: tenPM, hour: 21, minute: 0, loggedToday: false });
    expect(dates[0].getDate()).toBe(9);
  });
});
