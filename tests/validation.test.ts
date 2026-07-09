import { describe, expect, it } from 'vitest';
import { accountSchema, goalSchema, makeTransactionSchema } from '../lib/validation';

const schema = makeTransactionSchema('2026-07-08');

describe('makeTransactionSchema', () => {
  it('acepta un gasto válido', () => {
    const r = schema.safeParse({ kind: 'gasto', amount: 25000, date: '2026-07-08', accountId: 1, categoryId: 2 });
    expect(r.success).toBe(true);
  });
  it('rechaza fecha futura, monto no entero, monto gigante', () => {
    expect(schema.safeParse({ kind: 'gasto', amount: 100, date: '2026-07-09', accountId: 1, categoryId: 2 }).success).toBe(false);
    expect(schema.safeParse({ kind: 'gasto', amount: 10.5, date: '2026-07-08', accountId: 1, categoryId: 2 }).success).toBe(false);
    expect(schema.safeParse({ kind: 'gasto', amount: 10_000_000_000, date: '2026-07-08', accountId: 1, categoryId: 2 }).success).toBe(false);
  });
  it('transferencia: exige destino distinto', () => {
    expect(schema.safeParse({ kind: 'transferencia', amount: 100, date: '2026-07-08', accountId: 1, toAccountId: 1 }).success).toBe(false);
    expect(schema.safeParse({ kind: 'transferencia', amount: 100, date: '2026-07-08', accountId: 1, toAccountId: 2 }).success).toBe(true);
  });
});

describe('accountSchema / goalSchema', () => {
  it('valida nombre y números', () => {
    expect(accountSchema.safeParse({ name: '', type: 'debito', initialBalance: 0 }).success).toBe(false);
    expect(accountSchema.safeParse({ name: 'Nequi', type: 'debito', initialBalance: 10000 }).success).toBe(true);
    expect(goalSchema.safeParse({ name: 'Viaje', targetAmount: 0 }).success).toBe(false);
    expect(goalSchema.safeParse({ name: 'Viaje', targetAmount: 500000 }).success).toBe(true);
  });
});
