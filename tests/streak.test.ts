import { describe, expect, it } from 'vitest';
import { displayStreak, ensureAppState, logToday, nextStreak } from '../db/repos/streak';
import { createTestDb } from './helpers/testDb';

describe('nextStreak', () => {
  it('mismo día: sin cambios', () => {
    const s = { currentStreak: 3, bestStreak: 5, lastLoggedDate: '2026-07-08' };
    expect(nextStreak(s, '2026-07-08')).toEqual(s);
  });
  it('ayer: incrementa y actualiza best', () => {
    expect(nextStreak({ currentStreak: 5, bestStreak: 5, lastLoggedDate: '2026-07-07' }, '2026-07-08')).toEqual({
      currentStreak: 6,
      bestStreak: 6,
      lastLoggedDate: '2026-07-08',
    });
  });
  it('antes de ayer o null: reinicia en 1', () => {
    expect(nextStreak({ currentStreak: 9, bestStreak: 9, lastLoggedDate: '2026-07-01' }, '2026-07-08').currentStreak).toBe(1);
    expect(nextStreak({ currentStreak: 0, bestStreak: 0, lastLoggedDate: null }, '2026-07-08').currentStreak).toBe(1);
  });
});

describe('displayStreak', () => {
  it('vigente si registró hoy o ayer; 0 si está rota', () => {
    expect(displayStreak({ currentStreak: 4, bestStreak: 4, lastLoggedDate: '2026-07-08' }, '2026-07-08')).toBe(4);
    expect(displayStreak({ currentStreak: 4, bestStreak: 4, lastLoggedDate: '2026-07-07' }, '2026-07-08')).toBe(4);
    expect(displayStreak({ currentStreak: 4, bestStreak: 4, lastLoggedDate: '2026-07-05' }, '2026-07-08')).toBe(0);
  });
});

describe('logToday', () => {
  it('crea la fila si no existe y persiste la racha', () => {
    const db = createTestDb();
    expect(ensureAppState(db)).toEqual({ currentStreak: 0, bestStreak: 0, lastLoggedDate: null });
    expect(logToday(db, '2026-07-08').currentStreak).toBe(1);
    expect(logToday(db, '2026-07-08').currentStreak).toBe(1); // idempotente el mismo día
    expect(logToday(db, '2026-07-09').currentStreak).toBe(2);
    expect(ensureAppState(db)).toEqual({ currentStreak: 2, bestStreak: 2, lastLoggedDate: '2026-07-09' });
  });
});
