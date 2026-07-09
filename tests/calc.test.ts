import { describe, expect, it } from 'vitest';
import type { Account, Category, SavingsGoal, Tx } from '../db/schema';
import { accountBalance, balanceByMonth, expensesByCategory, goalProgress, monthSummary } from '../lib/calc';

const acc = (id: number, initialBalance = 0): Account =>
  ({ id, name: `Cuenta ${id}`, type: 'debito', initialBalance, archivedAt: null, createdAt: '' }) as Account;

const tx = (p: Partial<Tx>): Tx =>
  ({ id: 1, kind: 'gasto', amount: 0, date: '2026-07-01', accountId: 1, toAccountId: null, categoryId: null, note: null, createdAt: '', ...p }) as Tx;

const cat = (id: number, name: string, color = '#f00'): Category =>
  ({ id, name, kind: 'gasto', icon: 'Circle', color, archivedAt: null }) as Category;

describe('accountBalance', () => {
  it('suma inicial + ingresos - gastos ± transferencias', () => {
    const a = acc(1, 100000);
    const txs = [
      tx({ kind: 'ingreso', amount: 50000, accountId: 1 }),
      tx({ kind: 'gasto', amount: 20000, accountId: 1 }),
      tx({ kind: 'transferencia', amount: 10000, accountId: 1, toAccountId: 2 }),
      tx({ kind: 'transferencia', amount: 5000, accountId: 2, toAccountId: 1 }),
      tx({ kind: 'gasto', amount: 99999, accountId: 2 }),
    ];
    expect(accountBalance(a, txs)).toBe(100000 + 50000 - 20000 - 10000 + 5000);
  });
});

describe('monthSummary', () => {
  it('filtra por mes y excluye transferencias', () => {
    const txs = [
      tx({ kind: 'ingreso', amount: 300000, date: '2026-07-01' }),
      tx({ kind: 'gasto', amount: 100000, date: '2026-07-15' }),
      tx({ kind: 'transferencia', amount: 50000, date: '2026-07-15', toAccountId: 2 }),
      tx({ kind: 'gasto', amount: 999, date: '2026-06-30' }),
    ];
    expect(monthSummary(txs, '2026-07')).toEqual({ ingresos: 300000, gastos: 100000, balance: 200000 });
  });
});

describe('expensesByCategory', () => {
  it('agrupa, ordena desc y agrupa el resto en "Otras"', () => {
    const cats = [cat(1, 'Mercado'), cat(2, 'Transporte'), cat(3, 'Ocio')];
    const txs = [
      tx({ kind: 'gasto', amount: 30000, categoryId: 1 }),
      tx({ kind: 'gasto', amount: 10000, categoryId: 1 }),
      tx({ kind: 'gasto', amount: 25000, categoryId: 2 }),
      tx({ kind: 'gasto', amount: 5000, categoryId: 3 }),
      tx({ kind: 'ingreso', amount: 99999, categoryId: 1 }),
    ];
    const result = expensesByCategory(txs, cats, '2026-07', 2);
    expect(result).toEqual([
      { categoryId: 1, name: 'Mercado', color: '#f00', total: 40000 },
      { categoryId: 2, name: 'Transporte', color: '#f00', total: 25000 },
      { categoryId: null, name: 'Otras', color: '#9ca3af', total: 5000 },
    ]);
  });
});

describe('balanceByMonth', () => {
  it('devuelve balance por cada mes pedido', () => {
    const txs = [
      tx({ kind: 'ingreso', amount: 100, date: '2026-06-01' }),
      tx({ kind: 'gasto', amount: 40, date: '2026-07-01' }),
    ];
    expect(balanceByMonth(txs, ['2026-06', '2026-07'])).toEqual([
      { month: '2026-06', balance: 100 },
      { month: '2026-07', balance: -40 },
    ]);
  });
});

describe('goalProgress', () => {
  const goal = (p: Partial<SavingsGoal>): SavingsGoal =>
    ({ id: 1, name: 'Viaje', targetAmount: 1000000, accountId: null, manualAmount: 0, archivedAt: null, createdAt: '', ...p }) as SavingsGoal;

  it('meta ligada a cuenta usa el saldo de la cuenta', () => {
    const a = acc(1, 200000);
    expect(goalProgress(goal({ accountId: 1 }), [a], [tx({ kind: 'ingreso', amount: 50000, accountId: 1 })])).toBe(250000);
  });
  it('meta manual usa manualAmount', () => {
    expect(goalProgress(goal({ manualAmount: 70000 }), [], [])).toBe(70000);
  });
});
