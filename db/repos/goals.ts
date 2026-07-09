import { eq } from 'drizzle-orm';
import { savingsGoals } from '../schema';
import type { DB } from '../types';

export function createGoal(db: DB, input: { name: string; targetAmount: number; accountId?: number | null }): number {
  const clean = input.name.trim();
  if (!clean) throw new Error('El nombre no puede estar vacío');
  if (!Number.isInteger(input.targetAmount) || input.targetAmount <= 0) throw new Error('El objetivo debe ser un entero mayor que 0');
  const res = db
    .insert(savingsGoals)
    .values({ name: clean, targetAmount: input.targetAmount, accountId: input.accountId ?? null, createdAt: new Date().toISOString() })
    .run();
  return Number(res.lastInsertRowid);
}

export function addToGoal(db: DB, id: number, amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('El abono debe ser un entero mayor que 0');
  const goal = db.select().from(savingsGoals).where(eq(savingsGoals.id, id)).get();
  if (!goal) throw new Error('La meta no existe');
  if (goal.accountId != null) throw new Error('Esta meta sigue el saldo de una cuenta; abónale a la cuenta');
  db.update(savingsGoals).set({ manualAmount: goal.manualAmount + amount }).where(eq(savingsGoals.id, id)).run();
}

export function archiveGoal(db: DB, id: number): void {
  db.update(savingsGoals).set({ archivedAt: new Date().toISOString() }).where(eq(savingsGoals.id, id)).run();
}

export function deleteGoal(db: DB, id: number): void {
  db.delete(savingsGoals).where(eq(savingsGoals.id, id)).run();
}
