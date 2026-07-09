import { beforeEach, describe, expect, it } from 'vitest';
import { transactions } from '../db/schema';
import { createAccount } from '../db/repos/accounts';
import { createCategory } from '../db/repos/categories';
import { ensureAppState } from '../db/repos/streak';
import { createTransaction, deleteTransaction, updateTransaction } from '../db/repos/transactions';
import { createTestDb } from './helpers/testDb';
import type { DB } from '../db/types';

let db: DB;
let acc1: number;
let acc2: number;
let catGasto: number;

beforeEach(() => {
  db = createTestDb();
  acc1 = createAccount(db, { name: 'Débito', type: 'debito', initialBalance: 0 });
  acc2 = createAccount(db, { name: 'Ahorro', type: 'ahorro', initialBalance: 0 });
  catGasto = createCategory(db, { name: 'Mercado', kind: 'gasto', icon: 'ShoppingCart', color: '#ef4444' });
});

describe('createTransaction', () => {
  it('crea un gasto y actualiza la racha si es de hoy', () => {
    const id = createTransaction(db, { kind: 'gasto', amount: 25000, date: '2026-07-08', accountId: acc1, categoryId: catGasto }, '2026-07-08');
    expect(id).toBeGreaterThan(0);
    expect(ensureAppState(db).currentStreak).toBe(1);
  });

  it('con fecha pasada NO toca la racha', () => {
    createTransaction(db, { kind: 'gasto', amount: 25000, date: '2026-07-01', accountId: acc1, categoryId: catGasto }, '2026-07-08');
    expect(ensureAppState(db).currentStreak).toBe(0);
  });

  it('valida monto entero positivo', () => {
    const base = { kind: 'gasto' as const, date: '2026-07-08', accountId: acc1, categoryId: catGasto };
    expect(() => createTransaction(db, { ...base, amount: 0 }, '2026-07-08')).toThrow();
    expect(() => createTransaction(db, { ...base, amount: -5 }, '2026-07-08')).toThrow();
    expect(() => createTransaction(db, { ...base, amount: 10.5 }, '2026-07-08')).toThrow();
  });

  it('gasto/ingreso exigen categoría; transferencia exige destino distinto y anula categoría', () => {
    expect(() => createTransaction(db, { kind: 'gasto', amount: 100, date: '2026-07-08', accountId: acc1 }, '2026-07-08')).toThrow();
    expect(() =>
      createTransaction(db, { kind: 'transferencia', amount: 100, date: '2026-07-08', accountId: acc1, toAccountId: acc1 }, '2026-07-08'),
    ).toThrow();
    const id = createTransaction(
      db,
      { kind: 'transferencia', amount: 100, date: '2026-07-08', accountId: acc1, toAccountId: acc2, categoryId: catGasto },
      '2026-07-08',
    );
    const row = db.select().from(transactions).all().find((t) => t.id === id)!;
    expect(row.categoryId).toBeNull();
    expect(row.toAccountId).toBe(acc2);
  });
});

describe('updateTransaction / deleteTransaction', () => {
  it('edita monto y fecha; rechaza cambiar kind y transferencia con origen=destino', () => {
    const id = createTransaction(db, { kind: 'gasto', amount: 100, date: '2026-07-08', accountId: acc1, categoryId: catGasto }, '2026-07-08');
    updateTransaction(db, id, { amount: 200, date: '2026-07-07' });
    const row = db.select().from(transactions).all()[0];
    expect(row.amount).toBe(200);
    expect(row.date).toBe('2026-07-07');
    expect(() => updateTransaction(db, id, { kind: 'ingreso' } as never)).toThrow();

    const tr = createTransaction(db, { kind: 'transferencia', amount: 50, date: '2026-07-08', accountId: acc1, toAccountId: acc2 }, '2026-07-08');
    expect(() => updateTransaction(db, tr, { toAccountId: acc1 })).toThrow();
  });

  it('borra', () => {
    const id = createTransaction(db, { kind: 'gasto', amount: 100, date: '2026-07-08', accountId: acc1, categoryId: catGasto }, '2026-07-08');
    deleteTransaction(db, id);
    expect(db.select().from(transactions).all()).toHaveLength(0);
  });
});
