import { describe, expect, it } from 'vitest';
import { isNull } from 'drizzle-orm';
import { accounts, transactions } from '../db/schema';
import { createAccount, removeAccount, updateAccount } from '../db/repos/accounts';
import { createCategory } from '../db/repos/categories';
import { archiveGoal, createGoal } from '../db/repos/goals';
import { cardDebt } from '../lib/calc';
import { createTestDb } from './helpers/testDb';

describe('accounts repo', () => {
  it('crea cuenta y rechaza nombre vacío o duplicado entre activas', () => {
    const db = createTestDb();
    const id = createAccount(db, { name: 'Bancolombia', type: 'debito', initialBalance: 100000 });
    expect(id).toBeGreaterThan(0);
    expect(() => createAccount(db, { name: '  ', type: 'efectivo', initialBalance: 0 })).toThrow();
    expect(() => createAccount(db, { name: 'Bancolombia', type: 'ahorro', initialBalance: 0 })).toThrow();
  });

  it('removeAccount borra si no tiene movimientos, archiva si los tiene', () => {
    const db = createTestDb();
    const sinMov = createAccount(db, { name: 'Vacía', type: 'efectivo', initialBalance: 0 });
    expect(removeAccount(db, sinMov)).toBe('deleted');

    const conMov = createAccount(db, { name: 'Usada', type: 'debito', initialBalance: 0 });
    const catId = createCategory(db, { name: 'Mercado', kind: 'gasto', icon: 'ShoppingCart', color: '#ef4444' });
    db.insert(transactions)
      .values({ kind: 'gasto', amount: 1000, date: '2026-07-01', accountId: conMov, categoryId: catId, createdAt: '2026-07-01T12:00:00Z' })
      .run();
    expect(removeAccount(db, conMov)).toBe('archived');
    expect(db.select().from(accounts).where(isNull(accounts.archivedAt)).all()).toHaveLength(0);
    expect(db.select().from(accounts).all()).toHaveLength(1);
  });

  it('removeAccount rechaza cuenta ligada a una meta activa, permite tras archivarla', () => {
    const db = createTestDb();
    const accId = createAccount(db, { name: 'Ahorro viaje', type: 'ahorro', initialBalance: 0 });
    const goalId = createGoal(db, { name: 'Viaje', targetAmount: 1000000, accountId: accId });
    expect(() => removeAccount(db, accId)).toThrow(/ligada a la meta "Viaje"/);
    archiveGoal(db, goalId);
    expect(removeAccount(db, accId)).toBe('deleted');
  });

  it('updateAccount cambia nombre y saldo inicial', () => {
    const db = createTestDb();
    const id = createAccount(db, { name: 'Caja', type: 'efectivo', initialBalance: 0 });
    updateAccount(db, id, { name: 'Caja menor', initialBalance: 5000 });
    const row = db.select().from(accounts).all()[0];
    expect(row.name).toBe('Caja menor');
    expect(row.initialBalance).toBe(5000);
  });

  it('crea tarjeta de crédito con cupo y fechas', () => {
    const db = createTestDb();
    const id = createAccount(db, { name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 3000000, cutoffDay: 15, dueDay: 5 });
    const row = db.select().from(accounts).all()[0];
    expect(row.type).toBe('credito');
    expect(row.creditLimit).toBe(3000000);
    expect(row.cutoffDay).toBe(15);
    expect(row.dueDay).toBe(5);
    expect(id).toBeGreaterThan(0);
  });

  it('updateAccount edita cupo y fechas de la tarjeta', () => {
    const db = createTestDb();
    const id = createAccount(db, { name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 3000000, cutoffDay: 15, dueDay: 5 });
    updateAccount(db, id, { creditLimit: 4000000, cutoffDay: 20 });
    const row = db.select().from(accounts).all()[0];
    expect(row.creditLimit).toBe(4000000);
    expect(row.cutoffDay).toBe(20);
    expect(row.dueDay).toBe(5);
  });

  it('editar nombre de una tarjeta no re-ancla la deuda (no duplica cardDebt)', () => {
    const db = createTestDb();
    const id = createAccount(db, { name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 3000000, cutoffDay: 15, dueDay: 5 });
    const catId = createCategory(db, { name: 'Mercado', kind: 'gasto', icon: 'ShoppingCart', color: '#ef4444' });
    db.insert(transactions)
      .values({ kind: 'gasto', amount: 500000, date: '2026-07-01', accountId: id, categoryId: catId, createdAt: '2026-07-01T12:00:00Z' })
      .run();
    const card = db.select().from(accounts).all().find((a) => a.id === id)!;
    expect(cardDebt(card, db.select().from(transactions).all())).toBe(500000);
    updateAccount(db, id, { name: 'Visa Oro', creditLimit: 4000000, cutoffDay: 20, dueDay: 5 });
    const card2 = db.select().from(accounts).all().find((a) => a.id === id)!;
    expect(card2.name).toBe('Visa Oro');
    expect(cardDebt(card2, db.select().from(transactions).all())).toBe(500000); // sin cambios, no duplicado
  });
});
