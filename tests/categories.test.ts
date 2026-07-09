import { describe, expect, it } from 'vitest';
import { categories } from '../db/schema';
import { createCategory, removeCategory, SEED_CATEGORIES, seedIfEmpty } from '../db/repos/categories';
import { createTestDb } from './helpers/testDb';

describe('categories repo', () => {
  it('seedIfEmpty inserta las semillas una sola vez', () => {
    const db = createTestDb();
    seedIfEmpty(db);
    seedIfEmpty(db);
    const rows = db.select().from(categories).all();
    expect(rows).toHaveLength(SEED_CATEGORIES.length);
    expect(rows.filter((c) => c.kind === 'gasto').length).toBe(10);
    expect(rows.filter((c) => c.kind === 'ingreso').length).toBe(4);
  });

  it('crea y rechaza duplicados activos; archiva/borra según uso', () => {
    const db = createTestDb();
    const id = createCategory(db, { name: 'Mascotas', kind: 'gasto', icon: 'PawPrint', color: '#8b5cf6' });
    expect(() => createCategory(db, { name: 'Mascotas', kind: 'gasto', icon: 'PawPrint', color: '#000' })).toThrow();
    expect(removeCategory(db, id)).toBe('deleted');
  });
});
