import type { Account, Category, SavingsGoal, Tx } from '../db/schema';

export function accountBalance(account: Account, txs: Tx[]): number {
  let bal = account.initialBalance;
  for (const t of txs) {
    if (t.kind === 'ingreso' && t.accountId === account.id) bal += t.amount;
    else if (t.kind === 'gasto' && t.accountId === account.id) bal -= t.amount;
    else if (t.kind === 'transferencia') {
      if (t.accountId === account.id) bal -= t.amount;
      if (t.toAccountId === account.id) bal += t.amount;
    }
  }
  return bal;
}

export function monthSummary(txs: Tx[], month: string): { ingresos: number; gastos: number; balance: number } {
  let ingresos = 0;
  let gastos = 0;
  for (const t of txs) {
    if (!t.date.startsWith(month)) continue;
    if (t.kind === 'ingreso') ingresos += t.amount;
    else if (t.kind === 'gasto') gastos += t.amount;
  }
  return { ingresos, gastos, balance: ingresos - gastos };
}

export function expensesByCategory(
  txs: Tx[],
  categories: Category[],
  month: string,
  top = 5,
): { categoryId: number | null; name: string; color: string; total: number }[] {
  const totals = new Map<number, number>();
  for (const t of txs) {
    if (t.kind !== 'gasto' || !t.date.startsWith(month) || t.categoryId == null) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount);
  }
  const rows = [...totals.entries()]
    .map(([categoryId, total]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return { categoryId: categoryId as number | null, name: cat?.name ?? 'Sin categoría', color: cat?.color ?? '#9ca3af', total };
    })
    .sort((a, b) => b.total - a.total);
  if (rows.length <= top) return rows;
  const resto = rows.slice(top).reduce((s, r) => s + r.total, 0);
  return [...rows.slice(0, top), { categoryId: null, name: 'Otras', color: '#9ca3af', total: resto }];
}

export function balanceByMonth(txs: Tx[], months: string[]): { month: string; balance: number }[] {
  return months.map((month) => ({ month, balance: monthSummary(txs, month).balance }));
}

export function goalProgress(goal: SavingsGoal, accounts: Account[], txs: Tx[]): number {
  if (goal.accountId != null) {
    const acc = accounts.find((a) => a.id === goal.accountId);
    return acc ? accountBalance(acc, txs) : 0;
  }
  return goal.manualAmount;
}
