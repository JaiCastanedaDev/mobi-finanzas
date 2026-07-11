import { and, eq, isNull, or } from 'drizzle-orm';
import { accounts, savingsGoals, transactions } from '../schema';
import type { DB } from '../types';

type AccountInput = { name: string; type: 'debito' | 'ahorro' | 'efectivo'; initialBalance: number };

function assertNameFree(db: DB, name: string, exceptId?: number) {
  const clean = name.trim();
  if (!clean) throw new Error('El nombre no puede estar vacío');
  const clash = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.name, clean), isNull(accounts.archivedAt)))
    .all()
    .find((r) => r.id !== exceptId);
  if (clash) throw new Error(`Ya existe una cuenta llamada "${clean}"`);
}

export function createAccount(db: DB, input: AccountInput): number {
  assertNameFree(db, input.name);
  const res = db
    .insert(accounts)
    .values({ name: input.name.trim(), type: input.type, initialBalance: input.initialBalance, createdAt: new Date().toISOString() })
    .run();
  return Number(res.lastInsertRowid);
}

export function updateAccount(db: DB, id: number, patch: Partial<AccountInput>): void {
  if (patch.name !== undefined) assertNameFree(db, patch.name, id);
  db.update(accounts)
    .set({ ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}) })
    .where(eq(accounts.id, id))
    .run();
}

export function removeAccount(db: DB, id: number): 'deleted' | 'archived' {
  const linked = db
    .select({ name: savingsGoals.name })
    .from(savingsGoals)
    .where(and(eq(savingsGoals.accountId, id), isNull(savingsGoals.archivedAt)))
    .limit(1)
    .all();
  if (linked.length > 0) {
    throw new Error(`La cuenta está ligada a la meta "${linked[0].name}". Elimina o archiva esa meta primero.`);
  }
  const used = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)))
    .limit(1)
    .all();
  if (used.length === 0) {
    // Las metas archivadas pueden seguir apuntando a la cuenta; se desligan para no violar la FK.
    db.update(savingsGoals).set({ accountId: null }).where(eq(savingsGoals.accountId, id)).run();
    db.delete(accounts).where(eq(accounts.id, id)).run();
    return 'deleted';
  }
  db.update(accounts).set({ archivedAt: new Date().toISOString() }).where(eq(accounts.id, id)).run();
  return 'archived';
}
