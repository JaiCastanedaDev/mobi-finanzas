import { describe, expect, it } from 'vitest';
import { savingsGoals } from '../db/schema';
import { createAccount } from '../db/repos/accounts';
import { addToGoal, archiveGoal, createGoal, deleteGoal, updateGoal } from '../db/repos/goals';
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

describe('goals repo — targetDate y updateGoal', () => {
  it('crea meta con fecha objetivo', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000, targetDate: '2026-12-31' });
    expect(db.select().from(savingsGoals).all()[0].targetDate).toBe('2026-12-31');
    expect(id).toBeGreaterThan(0);
  });
  it('actualiza nombre, objetivo y fecha', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000 });
    updateGoal(db, id, { name: 'Viaje a San Andrés', targetAmount: 1500000, targetDate: '2027-01-31' });
    const row = db.select().from(savingsGoals).all()[0];
    expect(row.name).toBe('Viaje a San Andrés');
    expect(row.targetAmount).toBe(1500000);
    expect(row.targetDate).toBe('2027-01-31');
  });
  it('updateGoal puede quitar la fecha (null)', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000, targetDate: '2026-12-31' });
    updateGoal(db, id, { targetDate: null });
    expect(db.select().from(savingsGoals).all()[0].targetDate).toBeNull();
  });
  it('updateGoal que omite targetDate deja la fecha intacta', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000, targetDate: '2026-12-31' });
    updateGoal(db, id, { name: 'Viaje editado' });
    const row = db.select().from(savingsGoals).all()[0];
    expect(row.name).toBe('Viaje editado');
    expect(row.targetDate).toBe('2026-12-31');
  });
  it('updateGoal valida nombre vacío y objetivo inválido', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000 });
    expect(() => updateGoal(db, id, { name: '  ' })).toThrow();
    expect(() => updateGoal(db, id, { targetAmount: 0 })).toThrow();
  });
});
