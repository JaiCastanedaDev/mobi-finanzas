import { describe, expect, it } from 'vitest';
import { accounts, transactions } from '../db/schema';
import { createTestDb } from './helpers/testDb';

describe('schema', () => {
  it('crea las tablas y permite insertar', () => {
    const db = createTestDb();
    db.insert(accounts)
      .values({ name: 'Efectivo', type: 'efectivo', initialBalance: 50000, createdAt: '2026-07-08T00:00:00Z' })
      .run();
    const rows = db.select().from(accounts).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Efectivo');
    expect(db.select().from(transactions).all()).toHaveLength(0);
  });
});
