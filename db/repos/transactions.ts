import { eq } from 'drizzle-orm';
import { todayISO } from '../../lib/dates';
import { transactions } from '../schema';
import type { DB } from '../types';
import { logToday } from './streak';

export type NewTransaction = {
  kind: 'gasto' | 'ingreso' | 'transferencia';
  amount: number;
  date: string;
  accountId: number;
  toAccountId?: number | null;
  categoryId?: number | null;
  note?: string | null;
};

export type TransactionPatch = Partial<Pick<NewTransaction, 'amount' | 'date' | 'accountId' | 'toAccountId' | 'categoryId' | 'note'>>;

function assertAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('El monto debe ser un entero mayor que 0');
}

export function createTransaction(db: DB, input: NewTransaction, today: string = todayISO()): number {
  assertAmount(input.amount);
  if (input.kind === 'transferencia') {
    if (input.toAccountId == null) throw new Error('La transferencia necesita cuenta destino');
    if (input.toAccountId === input.accountId) throw new Error('Origen y destino deben ser cuentas distintas');
  } else if (input.categoryId == null) {
    throw new Error('Falta la categoría');
  }
  return db.transaction((tx) => {
    const res = tx
      .insert(transactions)
      .values({
        kind: input.kind,
        amount: input.amount,
        date: input.date,
        accountId: input.accountId,
        toAccountId: input.kind === 'transferencia' ? input.toAccountId : null,
        categoryId: input.kind === 'transferencia' ? null : input.categoryId,
        note: input.note ?? null,
        createdAt: new Date().toISOString(),
      })
      .run();
    if (input.date === today) logToday(tx as unknown as DB, today);
    return Number(res.lastInsertRowid);
  });
}

export function updateTransaction(db: DB, id: number, patch: TransactionPatch): void {
  if ('kind' in patch) throw new Error('El tipo no se puede cambiar; borra el movimiento y créalo de nuevo');
  if (patch.amount !== undefined) assertAmount(patch.amount);
  const current = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!current) throw new Error('El movimiento no existe');
  if (current.kind === 'transferencia') {
    const from = patch.accountId ?? current.accountId;
    const to = patch.toAccountId ?? current.toAccountId;
    if (from === to) throw new Error('Origen y destino deben ser cuentas distintas');
  }
  db.update(transactions).set(patch).where(eq(transactions.id, id)).run();
}

export function deleteTransaction(db: DB, id: number): void {
  db.delete(transactions).where(eq(transactions.id, id)).run();
}
