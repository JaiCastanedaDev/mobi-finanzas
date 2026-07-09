import { and, eq, isNull } from 'drizzle-orm';
import { categories, transactions } from '../schema';
import type { DB } from '../types';

type CategoryInput = { name: string; kind: 'gasto' | 'ingreso'; icon: string; color: string };

export const SEED_CATEGORIES: CategoryInput[] = [
  { name: 'Mercado', kind: 'gasto', icon: 'ShoppingCart', color: '#ef4444' },
  { name: 'Transporte', kind: 'gasto', icon: 'Bus', color: '#f97316' },
  { name: 'Arriendo', kind: 'gasto', icon: 'Home', color: '#eab308' },
  { name: 'Comida fuera', kind: 'gasto', icon: 'UtensilsCrossed', color: '#22c55e' },
  { name: 'Servicios', kind: 'gasto', icon: 'Lightbulb', color: '#14b8a6' },
  { name: 'Salud', kind: 'gasto', icon: 'HeartPulse', color: '#3b82f6' },
  { name: 'Ocio', kind: 'gasto', icon: 'Gamepad2', color: '#8b5cf6' },
  { name: 'Ropa', kind: 'gasto', icon: 'Shirt', color: '#ec4899' },
  { name: 'Educación', kind: 'gasto', icon: 'GraduationCap', color: '#6366f1' },
  { name: 'Otros gastos', kind: 'gasto', icon: 'CircleEllipsis', color: '#78716c' },
  { name: 'Salario', kind: 'ingreso', icon: 'Briefcase', color: '#16a34a' },
  { name: 'Ventas', kind: 'ingreso', icon: 'HandCoins', color: '#0ea5e9' },
  { name: 'Regalos', kind: 'ingreso', icon: 'Gift', color: '#d946ef' },
  { name: 'Otros ingresos', kind: 'ingreso', icon: 'CirclePlus', color: '#84cc16' },
];

export function seedIfEmpty(db: DB): void {
  const existing = db.select({ id: categories.id }).from(categories).limit(1).all();
  if (existing.length > 0) return;
  db.insert(categories).values(SEED_CATEGORIES).run();
}

export function createCategory(db: DB, input: CategoryInput): number {
  const clean = input.name.trim();
  if (!clean) throw new Error('El nombre no puede estar vacío');
  const clash = db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.name, clean), isNull(categories.archivedAt)))
    .all();
  if (clash.length > 0) throw new Error(`Ya existe una categoría llamada "${clean}"`);
  const res = db.insert(categories).values({ ...input, name: clean }).run();
  return Number(res.lastInsertRowid);
}

export function removeCategory(db: DB, id: number): 'deleted' | 'archived' {
  const used = db.select({ id: transactions.id }).from(transactions).where(eq(transactions.categoryId, id)).limit(1).all();
  if (used.length === 0) {
    db.delete(categories).where(eq(categories.id, id)).run();
    return 'deleted';
  }
  db.update(categories).set({ archivedAt: new Date().toISOString() }).where(eq(categories.id, id)).run();
  return 'archived';
}
