import { and, eq, isNull } from 'drizzle-orm';
import { categories, transactions } from '../schema';
import type { DB } from '../types';

type CategoryInput = { name: string; kind: 'gasto' | 'ingreso'; icon: string; color: string };

// Paleta categórica cálida validada (banda de luminosidad, croma, separación CVD
// y contraste sobre superficie de tarjeta en modo claro y oscuro).
export const SEED_CATEGORIES: CategoryInput[] = [
  { name: 'Mercado', kind: 'gasto', icon: 'ShoppingCart', color: '#267b4c' },
  { name: 'Transporte', kind: 'gasto', icon: 'Bus', color: '#df6c32' },
  { name: 'Arriendo', kind: 'gasto', icon: 'Home', color: '#2f7fbe' },
  { name: 'Comida fuera', kind: 'gasto', icon: 'UtensilsCrossed', color: '#ab8b3d' },
  { name: 'Servicios', kind: 'gasto', icon: 'Lightbulb', color: '#7d6bc4' },
  { name: 'Salud', kind: 'gasto', icon: 'HeartPulse', color: '#0f9f88' },
  { name: 'Ocio', kind: 'gasto', icon: 'Gamepad2', color: '#c46761' },
  { name: 'Ropa', kind: 'gasto', icon: 'Shirt', color: '#6b7f2e' },
  { name: 'Educación', kind: 'gasto', icon: 'GraduationCap', color: '#a3599a' },
  { name: 'Otros gastos', kind: 'gasto', icon: 'CircleEllipsis', color: '#b0752b' },
  { name: 'Salario', kind: 'ingreso', icon: 'Briefcase', color: '#267b4c' },
  { name: 'Ventas', kind: 'ingreso', icon: 'HandCoins', color: '#2f7fbe' },
  { name: 'Regalos', kind: 'ingreso', icon: 'Gift', color: '#a3599a' },
  { name: 'Otros ingresos', kind: 'ingreso', icon: 'CirclePlus', color: '#ab8b3d' },
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
