import { describe, expect, it } from 'vitest';
import { savingsGoals } from '../db/schema';
import { createAccount } from '../db/repos/accounts';
import { addToGoal, archiveGoal, createGoal, deleteGoal } from '../db/repos/goals';
import { createTestDb } from './helpers/testDb';

describe('goals repo', () => {
  it('crea meta manual y abona', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 2000000 });
    addToGoal(db, id, 150000);
    addToGoal(db, id, 50000);
    expect(db.select().from(savingsGoals).all()[0].manualAmount).toBe(200000);
  });

  it('valida: nombre no vacío, objetivo > 0, abono > 0, no abonar a meta ligada', () => {
    const db = createTestDb();
    expect(() => createGoal(db, { name: ' ', targetAmount: 1000 })).toThrow();
    expect(() => createGoal(db, { name: 'X', targetAmount: 0 })).toThrow();
    const accId = createAccount(db, { name: 'Ahorro', type: 'ahorro', initialBalance: 0 });
    const ligada = createGoal(db, { name: 'Ligada', targetAmount: 1000, accountId: accId });
    expect(() => addToGoal(db, ligada, 100)).toThrow();
    const manual = createGoal(db, { name: 'Manual', targetAmount: 1000 });
    expect(() => addToGoal(db, manual, 0)).toThrow();
  });

  it('archiva y borra', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Meta', targetAmount: 1000 });
    archiveGoal(db, id);
    expect(db.select().from(savingsGoals).all()[0].archivedAt).not.toBeNull();
    deleteGoal(db, id);
    expect(db.select().from(savingsGoals).all()).toHaveLength(0);
  });
});
