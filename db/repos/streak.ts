import { eq } from 'drizzle-orm';
import { yesterdayOf } from '../../lib/dates';
import { appState } from '../schema';
import type { DB } from '../types';

export type StreakState = { currentStreak: number; bestStreak: number; lastLoggedDate: string | null };

export function nextStreak(s: StreakState, today: string): StreakState {
  if (s.lastLoggedDate === today) return s;
  const current = s.lastLoggedDate === yesterdayOf(today) ? s.currentStreak + 1 : 1;
  return { currentStreak: current, bestStreak: Math.max(s.bestStreak, current), lastLoggedDate: today };
}

export function displayStreak(s: StreakState, today: string): number {
  if (s.lastLoggedDate === today || s.lastLoggedDate === yesterdayOf(today)) return s.currentStreak;
  return 0;
}

export function ensureAppState(db: DB): StreakState {
  const row = db.select().from(appState).where(eq(appState.id, 1)).get();
  if (row) return { currentStreak: row.currentStreak, bestStreak: row.bestStreak, lastLoggedDate: row.lastLoggedDate };
  db.insert(appState).values({ id: 1, currentStreak: 0, bestStreak: 0, lastLoggedDate: null }).run();
  return { currentStreak: 0, bestStreak: 0, lastLoggedDate: null };
}

export function logToday(db: DB, today: string): StreakState {
  const next = nextStreak(ensureAppState(db), today);
  db.update(appState).set(next).where(eq(appState.id, 1)).run();
  return next;
}
