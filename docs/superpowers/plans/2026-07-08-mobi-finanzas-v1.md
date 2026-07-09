# Mobi Finanzas v1 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App móvil personal de finanzas (Expo/React Native), 100% local y offline: registro de gastos/ingresos/transferencias, dashboard con gráficas, racha diaria con notificaciones locales y metas de ahorro.

**Architecture:** Lecturas con `useLiveQuery` de Drizzle directamente en las pantallas; escrituras vía módulos de repositorio (funciones puras sin React, testeables contra SQLite en memoria); cálculos (saldos, agregaciones) como funciones puras sobre arrays en `lib/calc.ts`; Zustand solo para estado efímero de UI.

**Tech Stack:** Expo + TypeScript, Expo Router, NativeWind, expo-sqlite + Drizzle ORM, react-native-gifted-charts, React Hook Form + Zod, Zustand, expo-notifications, expo-sqlite/kv-store, lucide-react-native. Tests: Vitest + better-sqlite3.

**Spec:** `docs/superpowers/specs/2026-07-08-mobi-finanzas-design.md`

## Global Constraints

- **PROHIBIDO usar git.** El usuario hace los commits él mismo. Al terminar cada tarea, avisar "Tarea N lista para tu commit" y seguir. Nunca ejecutar `git init/add/commit/...`.
- Montos siempre en **COP como enteros positivos**; el signo lo da `kind` (`'gasto' | 'ingreso' | 'transferencia'`).
- Fechas de movimiento como texto local `YYYY-MM-DD`; timestamps como ISO datetime.
- Las transferencias se **excluyen de todas las estadísticas** (dashboard, resúmenes).
- Saldos de cuenta **siempre derivados**, nunca almacenados.
- Toda la UI en **español**.
- Imports **relativos** (sin alias `@/`) para que Vitest funcione sin configuración extra.
- Verificación: `npm test` (Vitest) y `npm run typecheck` (`tsc --noEmit`) deben pasar al cierre de cada tarea. UI se verifica manualmente en Expo Go (`npx expo start`).
- Nota Expo Go: las notificaciones locales funcionan en Expo Go; si en Android no aparecieran, probar con development build (limitación conocida de SDK recientes, no un bug del código).

## Estructura de archivos (mapa completo)

```
db/schema.ts            → tablas Drizzle + tipos inferidos
db/client.ts            → openDatabaseSync + drizzle (solo lo importan pantallas)
db/types.ts             → tipo DB portable (expo / better-sqlite3)
db/repos/streak.ts      → nextStreak, displayStreak, ensureAppState, logToday
db/repos/accounts.ts    → createAccount, updateAccount, removeAccount
db/repos/categories.ts  → SEED, seedIfEmpty, createCategory, removeCategory
db/repos/transactions.ts→ createTransaction, updateTransaction, deleteTransaction
db/repos/goals.ts       → createGoal, addToGoal, archiveGoal
lib/dates.ts            → todayISO, addDaysISO, yesterdayOf, monthOf, shiftMonth, lastNMonths, monthLabel
lib/money.ts            → formatCOP
lib/calc.ts             → accountBalance, monthSummary, expensesByCategory, balanceByMonth, goalProgress
lib/validation.ts       → makeTransactionSchema, accountSchema, goalSchema, categorySchema
lib/reminders.ts        → computeReminderDates (puro, testeable)
lib/notifications.ts    → permisos + rescheduleReminders (usa expo-notifications)
lib/prefs.ts            → getPrefs/setPrefs sobre expo-sqlite/kv-store
store/ui.ts             → Zustand: selectedMonth, categoryFilter
components/ui/Button.tsx, Card.tsx, Field.tsx, Chip.tsx
app/_layout.tsx         → migraciones, seed, listener de notificaciones, Stack
app/onboarding.tsx      → primera cuenta + hora recordatorio
app/(tabs)/_layout.tsx  → tab bar + gate de onboarding
app/(tabs)/index.tsx    → Dashboard
app/(tabs)/movimientos.tsx
app/(tabs)/cuentas.tsx
app/(tabs)/metas.tsx
app/movimiento/nuevo.tsx→ modal de registro + "Hoy no gasté"
app/movimiento/[id].tsx → ver/editar/borrar
app/ajustes/index.tsx   → recordatorio, tema, enlace a categorías
app/ajustes/categorias.tsx
tests/helpers/testDb.ts → DB en memoria con migraciones reales
tests/*.test.ts
drizzle/                → migraciones generadas (drizzle-kit)
```

---

### Task 1: Scaffold del proyecto

**Files:**
- Create: proyecto Expo en la raíz, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`, `vitest.config.ts`, `tests/smoke.test.ts`
- Modify: `package.json` (scripts), `.gitignore` (solo editar el archivo; sin comandos git)

**Interfaces:**
- Produces: proyecto que arranca en Expo Go, `npm test` y `npm run typecheck` funcionales, NativeWind operativo.

- [ ] **Step 1: Crear el proyecto Expo**

```bash
npx create-expo-app@latest .
npm run reset-project   # elimina las pantallas de ejemplo; responder "y" a borrar app-example
```

Si `create-expo-app` se queja del directorio no vacío (por `docs/`), crear en carpeta temporal y mover todo el contenido a la raíz.

- [ ] **Step 2: Instalar dependencias**

```bash
npx expo install expo-sqlite expo-notifications react-native-svg expo-linear-gradient @react-native-community/datetimepicker
npm i drizzle-orm zustand react-hook-form zod @hookform/resolvers react-native-gifted-charts lucide-react-native nativewind
npm i -D drizzle-kit vitest better-sqlite3 @types/better-sqlite3 tailwindcss babel-plugin-inline-import
```

- [ ] **Step 3: Configurar NativeWind + Metro + Babel**

`babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
```

`metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './global.css' });
```

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: { extend: {} },
  plugins: [],
};
```

`global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`nativewind-env.d.ts`:
```ts
/// <reference types="nativewind/types" />
```

- [ ] **Step 4: Configurar Vitest y scripts**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

En `package.json`, dentro de `"scripts"`, añadir:
```json
"test": "vitest run",
"typecheck": "tsc --noEmit"
```

`tests/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('vitest corre', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Verificar**

```bash
npm test          # Esperado: 1 passed
npm run typecheck # Esperado: sin errores
npx expo start    # Esperado: QR; la app abre en Expo Go con la pantalla index vacía del template
```

- [ ] **Step 6: Checkpoint — avisar "Tarea 1 lista para tu commit" (sin ejecutar git)**

---

### Task 2: Esquema Drizzle, migraciones, cliente y helper de tests

**Files:**
- Create: `db/schema.ts`, `db/types.ts`, `db/client.ts`, `drizzle.config.ts`, `tests/helpers/testDb.ts`, `tests/schema.test.ts`
- Generate: `drizzle/` (migraciones)

**Interfaces:**
- Produces: tablas `accounts`, `categories`, `transactions`, `savingsGoals`, `appState`; tipos `Account`, `Category`, `Tx`, `SavingsGoal`; tipo `DB`; `createTestDb(): DB`; `db` (cliente expo) y `expoDb` para `useLiveQuery`.

- [ ] **Step 1: Escribir el esquema**

`db/schema.ts`:
```ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['debito', 'ahorro', 'efectivo'] }).notNull(),
  initialBalance: integer('initial_balance').notNull().default(0),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['gasto', 'ingreso'] }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  archivedAt: text('archived_at'),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['gasto', 'ingreso', 'transferencia'] }).notNull(),
  amount: integer('amount').notNull(),
  date: text('date').notNull(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  toAccountId: integer('to_account_id').references(() => accounts.id),
  categoryId: integer('category_id').references(() => categories.id),
  note: text('note'),
  createdAt: text('created_at').notNull(),
});

export const savingsGoals = sqliteTable('savings_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  accountId: integer('account_id').references(() => accounts.id),
  manualAmount: integer('manual_amount').notNull().default(0),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
});

export const appState = sqliteTable('app_state', {
  id: integer('id').primaryKey(),
  currentStreak: integer('current_streak').notNull().default(0),
  bestStreak: integer('best_streak').notNull().default(0),
  lastLoggedDate: text('last_logged_date'),
});

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tx = typeof transactions.$inferSelect;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
```

`db/types.ts` (tipo que aceptan los repos — sirve para el driver expo y para better-sqlite3 en tests):
```ts
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

export type DB = BaseSQLiteDatabase<'sync', any, typeof schema>;
```

`db/client.ts`:
```ts
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const expoDb = openDatabaseSync('mobi.db', { enableChangeListener: true });
export const db = drizzle(expoDb, { schema });
```

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './db/schema.ts',
  out: './drizzle',
});
```

- [ ] **Step 2: Generar migraciones**

```bash
npx drizzle-kit generate
```
Esperado: crea `drizzle/0000_*.sql`, `drizzle/meta/` y `drizzle/migrations.js`.

- [ ] **Step 3: Escribir el helper de test y un test de esquema que falle primero**

`tests/helpers/testDb.ts`:
```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../../db/schema';
import type { DB } from '../../db/types';

export function createTestDb(): DB {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return db as unknown as DB;
}
```

`tests/schema.test.ts`:
```ts
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
```

- [ ] **Step 4: Correr tests**

```bash
npm test
```
Esperado: PASS (el "fallo primero" aquí es que sin los Steps 1-2 el test ni compila; si las migraciones no se generaron, `migrate` lanza error).

- [ ] **Step 5: `npm run typecheck` → sin errores**

- [ ] **Step 6: Checkpoint — "Tarea 2 lista para tu commit"**

---

### Task 3: Utilidades de fechas y dinero

**Files:**
- Create: `lib/dates.ts`, `lib/money.ts`, `tests/dates.test.ts`, `tests/money.test.ts`

**Interfaces:**
- Produces: `todayISO(now?: Date): string`, `addDaysISO(iso, days): string`, `yesterdayOf(iso): string`, `monthOf(iso): string`, `shiftMonth(month: string, delta: number): string`, `lastNMonths(n: number, today: string): string[]`, `monthLabel(month: string): string`, `formatCOP(amount: number): string`.

- [ ] **Step 1: Escribir tests que fallen**

`tests/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { addDaysISO, lastNMonths, monthLabel, monthOf, shiftMonth, todayISO, yesterdayOf } from '../lib/dates';

describe('dates', () => {
  it('todayISO formatea local YYYY-MM-DD', () => {
    expect(todayISO(new Date(2026, 6, 8))).toBe('2026-07-08');
  });
  it('addDaysISO cruza meses y años', () => {
    expect(addDaysISO('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysISO('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('yesterdayOf', () => {
    expect(yesterdayOf('2026-07-08')).toBe('2026-07-07');
  });
  it('monthOf y shiftMonth', () => {
    expect(monthOf('2026-07-08')).toBe('2026-07');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
  it('lastNMonths incluye el mes actual al final', () => {
    expect(lastNMonths(3, '2026-01-15')).toEqual(['2025-11', '2025-12', '2026-01']);
  });
  it('monthLabel en español', () => {
    expect(monthLabel('2026-07')).toBe('jul 2026');
  });
});
```

`tests/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatCOP } from '../lib/money';

describe('formatCOP', () => {
  it('separa miles con punto', () => {
    expect(formatCOP(1234567)).toBe('$1.234.567');
    expect(formatCOP(0)).toBe('$0');
    expect(formatCOP(-50000)).toBe('-$50.000');
  });
});
```

- [ ] **Step 2: Correr y verificar que fallan**

```bash
npm test
```
Esperado: FAIL (módulos inexistentes).

- [ ] **Step 3: Implementar**

`lib/dates.ts`:
```ts
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return todayISO(new Date(y, m - 1, d + days));
}

export function yesterdayOf(iso: string): string {
  return addDaysISO(iso, -1);
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const dt = new Date(y, m - 1 + delta, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

export function lastNMonths(n: number, today: string): string[] {
  const current = monthOf(today);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(shiftMonth(current, -i));
  return out;
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}
```

`lib/money.ts`:
```ts
export function formatCOP(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${grouped}`;
}
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores**

- [ ] **Step 5: Checkpoint — "Tarea 3 lista para tu commit"**

---

### Task 4: Cálculos puros (saldos y estadísticas)

**Files:**
- Create: `lib/calc.ts`, `tests/calc.test.ts`

**Interfaces:**
- Consumes: tipos `Account`, `Category`, `Tx`, `SavingsGoal` de `db/schema.ts`; `monthSummary` usa prefijo de mes sobre `Tx.date`.
- Produces:
  - `accountBalance(account: Account, txs: Tx[]): number`
  - `monthSummary(txs: Tx[], month: string): { ingresos: number; gastos: number; balance: number }`
  - `expensesByCategory(txs: Tx[], categories: Category[], month: string, top?: number): { categoryId: number | null; name: string; color: string; total: number }[]`
  - `balanceByMonth(txs: Tx[], months: string[]): { month: string; balance: number }[]`
  - `goalProgress(goal: SavingsGoal, accounts: Account[], txs: Tx[]): number`

- [ ] **Step 1: Escribir tests que fallen**

`tests/calc.test.ts`:
```ts
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
```

- [ ] **Step 2: `npm test` → FAIL (lib/calc no existe)**

- [ ] **Step 3: Implementar**

`lib/calc.ts`:
```ts
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
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores**

- [ ] **Step 5: Checkpoint — "Tarea 4 lista para tu commit"**

---

### Task 5: Racha (lógica pura + persistencia)

**Files:**
- Create: `db/repos/streak.ts`, `tests/streak.test.ts`

**Interfaces:**
- Consumes: `yesterdayOf` de `lib/dates.ts`; tabla `appState`; `DB` de `db/types.ts`.
- Produces:
  - `type StreakState = { currentStreak: number; bestStreak: number; lastLoggedDate: string | null }`
  - `nextStreak(s: StreakState, today: string): StreakState` (pura)
  - `displayStreak(s: StreakState, today: string): number` (pura)
  - `ensureAppState(db: DB): StreakState`
  - `logToday(db: DB, today: string): StreakState`

- [ ] **Step 1: Escribir tests que fallen**

`tests/streak.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { displayStreak, ensureAppState, logToday, nextStreak } from '../db/repos/streak';
import { createTestDb } from './helpers/testDb';

describe('nextStreak', () => {
  it('mismo día: sin cambios', () => {
    const s = { currentStreak: 3, bestStreak: 5, lastLoggedDate: '2026-07-08' };
    expect(nextStreak(s, '2026-07-08')).toEqual(s);
  });
  it('ayer: incrementa y actualiza best', () => {
    expect(nextStreak({ currentStreak: 5, bestStreak: 5, lastLoggedDate: '2026-07-07' }, '2026-07-08')).toEqual({
      currentStreak: 6,
      bestStreak: 6,
      lastLoggedDate: '2026-07-08',
    });
  });
  it('antes de ayer o null: reinicia en 1', () => {
    expect(nextStreak({ currentStreak: 9, bestStreak: 9, lastLoggedDate: '2026-07-01' }, '2026-07-08').currentStreak).toBe(1);
    expect(nextStreak({ currentStreak: 0, bestStreak: 0, lastLoggedDate: null }, '2026-07-08').currentStreak).toBe(1);
  });
});

describe('displayStreak', () => {
  it('vigente si registró hoy o ayer; 0 si está rota', () => {
    expect(displayStreak({ currentStreak: 4, bestStreak: 4, lastLoggedDate: '2026-07-08' }, '2026-07-08')).toBe(4);
    expect(displayStreak({ currentStreak: 4, bestStreak: 4, lastLoggedDate: '2026-07-07' }, '2026-07-08')).toBe(4);
    expect(displayStreak({ currentStreak: 4, bestStreak: 4, lastLoggedDate: '2026-07-05' }, '2026-07-08')).toBe(0);
  });
});

describe('logToday', () => {
  it('crea la fila si no existe y persiste la racha', () => {
    const db = createTestDb();
    expect(ensureAppState(db)).toEqual({ currentStreak: 0, bestStreak: 0, lastLoggedDate: null });
    expect(logToday(db, '2026-07-08').currentStreak).toBe(1);
    expect(logToday(db, '2026-07-08').currentStreak).toBe(1); // idempotente el mismo día
    expect(logToday(db, '2026-07-09').currentStreak).toBe(2);
    expect(ensureAppState(db)).toEqual({ currentStreak: 2, bestStreak: 2, lastLoggedDate: '2026-07-09' });
  });
});
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implementar**

`db/repos/streak.ts`:
```ts
import { eq } from 'drizzle-orm';
import { yesterdayOf } from '../../lib/dates';
import { appState } from '../schema';
import type { DB } from '../types';

export type StreakState = { currentStreak: number; bestStreak: number; lastLoggedDate: string | null };

export function nextStreak(s: StreakState, today: string): StreakState {
  if (s.lastLoggedDate === today) return s;
  const current = s.lastLoggedDate === yesterdayOf(today) ? s.currentStreak + 1 : 1;
  return { currentStreak: current, bestStreak: Math.max(s.bestStreak, current), lastLoggedDate: today };
}

export function displayStreak(s: StreakState, today: string): number {
  if (s.lastLoggedDate === today || s.lastLoggedDate === yesterdayOf(today)) return s.currentStreak;
  return 0;
}

export function ensureAppState(db: DB): StreakState {
  const row = db.select().from(appState).where(eq(appState.id, 1)).get();
  if (row) return { currentStreak: row.currentStreak, bestStreak: row.bestStreak, lastLoggedDate: row.lastLoggedDate };
  db.insert(appState).values({ id: 1, currentStreak: 0, bestStreak: 0, lastLoggedDate: null }).run();
  return { currentStreak: 0, bestStreak: 0, lastLoggedDate: null };
}

export function logToday(db: DB, today: string): StreakState {
  const next = nextStreak(ensureAppState(db), today);
  db.update(appState).set(next).where(eq(appState.id, 1)).run();
  return next;
}
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores**

- [ ] **Step 5: Checkpoint — "Tarea 5 lista para tu commit"**

---

### Task 6: Repos de cuentas y categorías (con seed)

**Files:**
- Create: `db/repos/accounts.ts`, `db/repos/categories.ts`, `tests/accounts.test.ts`, `tests/categories.test.ts`

**Interfaces:**
- Consumes: `DB`, tablas de `db/schema.ts`.
- Produces:
  - `createAccount(db, input: { name: string; type: 'debito' | 'ahorro' | 'efectivo'; initialBalance: number }): number`
  - `updateAccount(db, id: number, patch: Partial<{ name: string; type: ...; initialBalance: number }>): void`
  - `removeAccount(db, id: number): 'deleted' | 'archived'`
  - `SEED_CATEGORIES: { name: string; kind: 'gasto' | 'ingreso'; icon: string; color: string }[]`
  - `seedIfEmpty(db): void`
  - `createCategory(db, input: { name; kind; icon; color }): number`
  - `removeCategory(db, id: number): 'deleted' | 'archived'`

- [ ] **Step 1: Escribir tests que fallen**

`tests/accounts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isNull } from 'drizzle-orm';
import { accounts } from '../db/schema';
import { createAccount, removeAccount, updateAccount } from '../db/repos/accounts';
import { createTransaction } from '../db/repos/transactions';
import { createCategory } from '../db/repos/categories';
import { createTestDb } from './helpers/testDb';

describe('accounts repo', () => {
  it('crea cuenta y rechaza nombre vacío o duplicado entre activas', () => {
    const db = createTestDb();
    const id = createAccount(db, { name: 'Bancolombia', type: 'debito', initialBalance: 100000 });
    expect(id).toBeGreaterThan(0);
    expect(() => createAccount(db, { name: '  ', type: 'efectivo', initialBalance: 0 })).toThrow();
    expect(() => createAccount(db, { name: 'Bancolombia', type: 'ahorro', initialBalance: 0 })).toThrow();
  });

  it('removeAccount borra si no tiene movimientos, archiva si los tiene', () => {
    const db = createTestDb();
    const sinMov = createAccount(db, { name: 'Vacía', type: 'efectivo', initialBalance: 0 });
    expect(removeAccount(db, sinMov)).toBe('deleted');

    const conMov = createAccount(db, { name: 'Usada', type: 'debito', initialBalance: 0 });
    const catId = createCategory(db, { name: 'Mercado', kind: 'gasto', icon: 'ShoppingCart', color: '#ef4444' });
    createTransaction(db, { kind: 'gasto', amount: 1000, date: '2026-07-01', accountId: conMov, categoryId: catId }, '2026-07-08');
    expect(removeAccount(db, conMov)).toBe('archived');
    expect(db.select().from(accounts).where(isNull(accounts.archivedAt)).all()).toHaveLength(0);
    expect(db.select().from(accounts).all()).toHaveLength(1);
  });

  it('updateAccount cambia nombre y saldo inicial', () => {
    const db = createTestDb();
    const id = createAccount(db, { name: 'Caja', type: 'efectivo', initialBalance: 0 });
    updateAccount(db, id, { name: 'Caja menor', initialBalance: 5000 });
    const row = db.select().from(accounts).all()[0];
    expect(row.name).toBe('Caja menor');
    expect(row.initialBalance).toBe(5000);
  });
});
```

`tests/categories.test.ts`:
```ts
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
```

- [ ] **Step 2: `npm test` → FAIL** (nota: `tests/accounts.test.ts` importa `transactions repo` que aún no existe — crear en esta tarea un stub NO: la Task 7 lo implementa; para no bloquear, en esta tarea el test de "archiva si los tiene" puede insertar el movimiento directo con `db.insert(transactions).values(...)`. Usar esta variante:)

Reemplazo del bloque en `tests/accounts.test.ts` (sin depender de la Task 7):
```ts
import { transactions } from '../db/schema';
// ...dentro del test "removeAccount ... archiva si los tiene":
db.insert(transactions)
  .values({ kind: 'gasto', amount: 1000, date: '2026-07-01', accountId: conMov, categoryId: catId, createdAt: '2026-07-01T12:00:00Z' })
  .run();
```
(Eliminar los imports de `createTransaction`.)

- [ ] **Step 3: Implementar**

`db/repos/accounts.ts`:
```ts
import { and, eq, isNull, or } from 'drizzle-orm';
import { accounts, transactions } from '../schema';
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
  const used = db
    .select({ id: transactions.id })
    .from(transactions)
    .where(or(eq(transactions.accountId, id), eq(transactions.toAccountId, id)))
    .limit(1)
    .all();
  if (used.length === 0) {
    db.delete(accounts).where(eq(accounts.id, id)).run();
    return 'deleted';
  }
  db.update(accounts).set({ archivedAt: new Date().toISOString() }).where(eq(accounts.id, id)).run();
  return 'archived';
}
```

`db/repos/categories.ts`:
```ts
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
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores**

- [ ] **Step 5: Checkpoint — "Tarea 6 lista para tu commit"**

---

### Task 7: Repo de transacciones (integra racha)

**Files:**
- Create: `db/repos/transactions.ts`, `tests/transactions.test.ts`

**Interfaces:**
- Consumes: `logToday` (Task 5), `todayISO` (Task 3), tablas del esquema.
- Produces:
  - `type NewTransaction = { kind: 'gasto' | 'ingreso' | 'transferencia'; amount: number; date: string; accountId: number; toAccountId?: number | null; categoryId?: number | null; note?: string | null }`
  - `createTransaction(db, input: NewTransaction, today?: string): number` — inserta y, si `input.date === today`, actualiza la racha; todo en una transacción SQLite.
  - `type TransactionPatch = Partial<Pick<NewTransaction, 'amount' | 'date' | 'accountId' | 'toAccountId' | 'categoryId' | 'note'>>`
  - `updateTransaction(db, id: number, patch: TransactionPatch): void` — el `kind` no se puede cambiar.
  - `deleteTransaction(db, id: number): void`

- [ ] **Step 1: Escribir tests que fallen**

`tests/transactions.test.ts`:
```ts
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
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implementar**

`db/repos/transactions.ts`:
```ts
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
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores**

- [ ] **Step 5: Checkpoint — "Tarea 7 lista para tu commit"**

---

### Task 8: Repo de metas de ahorro

**Files:**
- Create: `db/repos/goals.ts`, `tests/goals.test.ts`

**Interfaces:**
- Consumes: tabla `savingsGoals`, `DB`.
- Produces:
  - `createGoal(db, input: { name: string; targetAmount: number; accountId?: number | null }): number`
  - `addToGoal(db, id: number, amount: number): void` — solo metas manuales; suma a `manualAmount`.
  - `archiveGoal(db, id: number): void`
  - `deleteGoal(db, id: number): void`

- [ ] **Step 1: Escribir tests que fallen**

`tests/goals.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { savingsGoals } from '../db/schema';
import { addToGoal, archiveGoal, createGoal, deleteGoal } from '../db/repos/goals';
import { createTestDb } from './helpers/testDb';

describe('goals repo', () => {
  it('crea meta manual y abona', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 2000000 });
    addToGoal(db, id, 150000);
    addToGoal(db, id, 50000);
    expect(db.select().from(savingsGoals).all()[0].manualAmount).toBe(200000);
  });

  it('valida: nombre no vacío, objetivo > 0, abono > 0, no abonar a meta ligada', () => {
    const db = createTestDb();
    expect(() => createGoal(db, { name: ' ', targetAmount: 1000 })).toThrow();
    expect(() => createGoal(db, { name: 'X', targetAmount: 0 })).toThrow();
    const ligada = createGoal(db, { name: 'Ligada', targetAmount: 1000, accountId: 1 });
    expect(() => addToGoal(db, ligada, 100)).toThrow();
    const manual = createGoal(db, { name: 'Manual', targetAmount: 1000 });
    expect(() => addToGoal(db, manual, 0)).toThrow();
  });

  it('archiva y borra', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Meta', targetAmount: 1000 });
    archiveGoal(db, id);
    expect(db.select().from(savingsGoals).all()[0].archivedAt).not.toBeNull();
    deleteGoal(db, id);
    expect(db.select().from(savingsGoals).all()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implementar**

`db/repos/goals.ts`:
```ts
import { eq } from 'drizzle-orm';
import { savingsGoals } from '../schema';
import type { DB } from '../types';

export function createGoal(db: DB, input: { name: string; targetAmount: number; accountId?: number | null }): number {
  const clean = input.name.trim();
  if (!clean) throw new Error('El nombre no puede estar vacío');
  if (!Number.isInteger(input.targetAmount) || input.targetAmount <= 0) throw new Error('El objetivo debe ser un entero mayor que 0');
  const res = db
    .insert(savingsGoals)
    .values({ name: clean, targetAmount: input.targetAmount, accountId: input.accountId ?? null, createdAt: new Date().toISOString() })
    .run();
  return Number(res.lastInsertRowid);
}

export function addToGoal(db: DB, id: number, amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('El abono debe ser un entero mayor que 0');
  const goal = db.select().from(savingsGoals).where(eq(savingsGoals.id, id)).get();
  if (!goal) throw new Error('La meta no existe');
  if (goal.accountId != null) throw new Error('Esta meta sigue el saldo de una cuenta; abónale a la cuenta');
  db.update(savingsGoals).set({ manualAmount: goal.manualAmount + amount }).where(eq(savingsGoals.id, id)).run();
}

export function archiveGoal(db: DB, id: number): void {
  db.update(savingsGoals).set({ archivedAt: new Date().toISOString() }).where(eq(savingsGoals.id, id)).run();
}

export function deleteGoal(db: DB, id: number): void {
  db.delete(savingsGoals).where(eq(savingsGoals.id, id)).run();
}
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores**

- [ ] **Step 5: Checkpoint — "Tarea 8 lista para tu commit"**

---

### Task 9: Esquemas Zod para formularios

**Files:**
- Create: `lib/validation.ts`, `tests/validation.test.ts`

**Interfaces:**
- Consumes: nada del proyecto (solo zod).
- Produces:
  - `makeTransactionSchema(today: string)` — discriminated union por `kind`; monto entero 1..9.999.999.999; fecha `YYYY-MM-DD` no futura; transferencia con `toAccountId !== accountId`.
  - `TransactionFormValues = z.infer<ReturnType<typeof makeTransactionSchema>>`
  - `accountSchema`, `categorySchema`, `goalSchema` (nombre no vacío + numéricos enteros).

- [ ] **Step 1: Escribir tests que fallen**

`tests/validation.test.ts`:
```ts
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
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implementar**

`lib/validation.ts`:
```ts
import { z } from 'zod';

const amount = z.number({ message: 'Escribe un monto' }).int('Debe ser un entero').positive('Debe ser mayor que 0').max(9_999_999_999, 'Monto demasiado grande');
const note = z.string().max(200).optional();

export function makeTransactionSchema(today: string) {
  const dateField = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .refine((d) => d <= today, 'La fecha no puede ser futura');
  const base = { amount, date: dateField, accountId: z.number({ message: 'Elige una cuenta' }).int(), note };
  return z
    .discriminatedUnion('kind', [
      z.object({ kind: z.literal('gasto'), categoryId: z.number({ message: 'Elige una categoría' }).int(), ...base }),
      z.object({ kind: z.literal('ingreso'), categoryId: z.number({ message: 'Elige una categoría' }).int(), ...base }),
      z.object({ kind: z.literal('transferencia'), toAccountId: z.number({ message: 'Elige la cuenta destino' }).int(), ...base }),
    ])
    .refine((v) => v.kind !== 'transferencia' || v.toAccountId !== v.accountId, {
      message: 'Origen y destino deben ser cuentas distintas',
      path: ['toAccountId'],
    });
}

export type TransactionFormValues = z.infer<ReturnType<typeof makeTransactionSchema>>;

export const accountSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre'),
  type: z.enum(['debito', 'ahorro', 'efectivo']),
  initialBalance: z.number({ message: 'Escribe el saldo inicial' }).int(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre'),
  kind: z.enum(['gasto', 'ingreso']),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const goalSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre'),
  targetAmount: amount,
  accountId: z.number().int().nullable().optional(),
});
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores**

- [ ] **Step 5: Checkpoint — "Tarea 9 lista para tu commit"**

---

### Task 10: Preferencias y recordatorios

**Files:**
- Create: `lib/reminders.ts` (puro), `lib/prefs.ts`, `lib/notifications.ts`, `tests/reminders.test.ts`

**Interfaces:**
- Consumes: `expo-notifications`, `expo-sqlite/kv-store`.
- Produces:
  - `computeReminderDates(opts: { now: Date; hour: number; minute: number; loggedToday: boolean; days?: number }): Date[]` (puro; 7 fechas por defecto; salta hoy si ya se registró o si la hora ya pasó)
  - `type Prefs = { reminderEnabled: boolean; reminderHour: number; reminderMinute: number; theme: 'system' | 'light' | 'dark' }`
  - `getPrefs(): Prefs`, `setPrefs(patch: Partial<Prefs>): Prefs`
  - `requestNotificationPermission(): Promise<boolean>`
  - `rescheduleReminders(opts: { loggedToday: boolean; streak: number }): Promise<void>` — lee prefs, cancela todo y programa las próximas 7.

- [ ] **Step 1: Escribir test del cálculo puro (falla primero)**

`tests/reminders.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeReminderDates } from '../lib/reminders';

describe('computeReminderDates', () => {
  const nineAM = new Date(2026, 6, 8, 9, 0); // 8 jul 2026, 9:00

  it('si no ha registrado y la hora no pasó, la primera es hoy', () => {
    const dates = computeReminderDates({ now: nineAM, hour: 21, minute: 0, loggedToday: false });
    expect(dates).toHaveLength(7);
    expect(dates[0].getDate()).toBe(8);
    expect(dates[0].getHours()).toBe(21);
    expect(dates[6].getDate()).toBe(14);
  });

  it('si ya registró hoy, arranca mañana', () => {
    const dates = computeReminderDates({ now: nineAM, hour: 21, minute: 0, loggedToday: true });
    expect(dates[0].getDate()).toBe(9);
  });

  it('si la hora de hoy ya pasó, arranca mañana', () => {
    const tenPM = new Date(2026, 6, 8, 22, 0);
    const dates = computeReminderDates({ now: tenPM, hour: 21, minute: 0, loggedToday: false });
    expect(dates[0].getDate()).toBe(9);
  });
});
```

- [ ] **Step 2: `npm test` → FAIL**

- [ ] **Step 3: Implementar**

`lib/reminders.ts`:
```ts
export function computeReminderDates(opts: { now: Date; hour: number; minute: number; loggedToday: boolean; days?: number }): Date[] {
  const { now, hour, minute, loggedToday, days = 7 } = opts;
  const first = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (loggedToday || first <= now) first.setDate(first.getDate() + 1);
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    dates.push(d);
  }
  return dates;
}
```

`lib/prefs.ts`:
```ts
import Storage from 'expo-sqlite/kv-store';

export type Prefs = {
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  theme: 'system' | 'light' | 'dark';
};

const DEFAULTS: Prefs = { reminderEnabled: true, reminderHour: 21, reminderMinute: 0, theme: 'system' };

export function getPrefs(): Prefs {
  const raw = Storage.getItemSync('prefs');
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  Storage.setItemSync('prefs', JSON.stringify(next));
  return next;
}
```

`lib/notifications.ts`:
```ts
import * as Notifications from 'expo-notifications';
import { getPrefs } from './prefs';
import { computeReminderDates } from './reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function rescheduleReminders(opts: { loggedToday: boolean; streak: number }): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const prefs = getPrefs();
  if (!prefs.reminderEnabled) return;
  const dates = computeReminderDates({
    now: new Date(),
    hour: prefs.reminderHour,
    minute: prefs.reminderMinute,
    loggedToday: opts.loggedToday,
  });
  const body =
    opts.streak > 0 ? `🔥 Llevas ${opts.streak} ${opts.streak === 1 ? 'día' : 'días'}. ¡No rompas la racha!` : 'Registra tus movimientos y arranca tu racha.';
  for (const date of dates) {
    await Notifications.scheduleNotificationAsync({
      content: { title: '¿Registraste tus gastos de hoy?', body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}
```

- [ ] **Step 4: `npm test` → PASS. `npm run typecheck` → sin errores** (si `tsc` se queja de claves del handler de notificaciones por versión del SDK, ajustar a las claves que el tipo `NotificationBehavior` pida — la intención es "mostrar alerta con sonido, sin badge").

- [ ] **Step 5: Checkpoint — "Tarea 10 lista para tu commit"**

---

### Task 11: Store de UI, componentes base y layout raíz

**Files:**
- Create: `store/ui.ts`, `components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Field.tsx`, `components/ui/Chip.tsx`, `app/_layout.tsx`
- Delete: `app/index.tsx` del template si `reset-project` dejó uno en la raíz de `app/` (el index real vivirá en `app/(tabs)/index.tsx`, Task 12+).

**Interfaces:**
- Consumes: `db`, migraciones (`drizzle/migrations`), `seedIfEmpty`, `ensureAppState`, `displayStreak`, `rescheduleReminders`, `getPrefs`, `todayISO`.
- Produces:
  - `useUI()` Zustand: `{ selectedMonth: string; categoryFilter: number | null; setMonth(m); setCategoryFilter(id) }`
  - `<Button label onPress variant? disabled />`, `<Card className? >`, `<Field label value onChangeText placeholder? keyboardType? error? />`, `<Chip label selected onPress color? />`
  - Layout raíz con migraciones bloqueantes + seed + reprogramación de recordatorios + listener que abre `/movimiento/nuevo` al tocar la notificación.

- [ ] **Step 1: Implementar store y componentes**

`store/ui.ts`:
```ts
import { create } from 'zustand';
import { monthOf, todayISO } from '../lib/dates';

type UIState = {
  selectedMonth: string;
  categoryFilter: number | null;
  setMonth: (m: string) => void;
  setCategoryFilter: (id: number | null) => void;
};

export const useUI = create<UIState>((set) => ({
  selectedMonth: monthOf(todayISO()),
  categoryFilter: null,
  setMonth: (selectedMonth) => set({ selectedMonth, categoryFilter: null }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
}));
```

`components/ui/Button.tsx`:
```tsx
import { Pressable, Text } from 'react-native';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean };

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const bg = variant === 'primary' ? 'bg-emerald-600' : variant === 'danger' ? 'bg-red-600' : 'bg-transparent';
  const txt = variant === 'ghost' ? 'text-emerald-700 dark:text-emerald-400' : 'text-white';
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`items-center rounded-xl px-4 py-3 ${bg} ${disabled ? 'opacity-40' : ''}`}>
      <Text className={`font-semibold ${txt}`}>{label}</Text>
    </Pressable>
  );
}
```

`components/ui/Card.tsx`:
```tsx
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <View className={`rounded-2xl bg-white p-4 dark:bg-neutral-900 ${className}`}>{children}</View>;
}
```

`components/ui/Field.tsx`:
```tsx
import { Text, TextInput, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  error?: string;
};

export function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', error }: Props) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        className="rounded-xl border border-neutral-300 px-3 py-3 text-base text-neutral-900 dark:border-neutral-700 dark:text-white"
      />
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
```

`components/ui/Chip.tsx`:
```tsx
import { Pressable, Text, View } from 'react-native';

type Props = { label: string; selected: boolean; onPress: () => void; color?: string };

export function Chip({ label, selected, onPress, color }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 flex-row items-center rounded-full border px-3 py-2 ${
        selected ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950' : 'border-neutral-300 dark:border-neutral-700'
      }`}
    >
      {color ? <View className="mr-1.5 h-3 w-3 rounded-full" style={{ backgroundColor: color }} /> : null}
      <Text className={selected ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300'}>{label}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 2: Implementar el layout raíz**

`app/_layout.tsx`:
```tsx
import '../global.css';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import migrations from '../drizzle/migrations';
import { db } from '../db/client';
import { seedIfEmpty } from '../db/repos/categories';
import { displayStreak, ensureAppState } from '../db/repos/streak';
import { todayISO } from '../lib/dates';
import { rescheduleReminders } from '../lib/notifications';
import { getPrefs } from '../lib/prefs';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    if (!success) return;
    setColorScheme(getPrefs().theme);
    seedIfEmpty(db);
    const state = ensureAppState(db);
    const today = todayISO();
    rescheduleReminders({ loggedToday: state.lastLoggedDate === today, streak: displayStreak(state, today) }).catch(() => {});
  }, [success]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/movimiento/nuevo');
    });
    return () => sub.remove();
  }, []);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-white p-6 dark:bg-neutral-950">
        <Text className="text-center text-red-600">Error preparando la base de datos: {error.message}</Text>
      </View>
    );
  }
  if (!success) return null;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="movimiento/nuevo" options={{ presentation: 'modal', title: 'Nuevo movimiento' }} />
      <Stack.Screen name="movimiento/[id]" options={{ title: 'Movimiento' }} />
      <Stack.Screen name="ajustes/index" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="ajustes/categorias" options={{ title: 'Categorías' }} />
    </Stack>
  );
}
```

- [ ] **Step 3: Verificar**

```bash
npm run typecheck   # sin errores
npm test            # todo sigue en verde
npx expo start      # la app abre (aún sin tabs: Expo Router mostrará "unmatched route" o pantalla vacía — se completa en Task 12)
```

- [ ] **Step 4: Checkpoint — "Tarea 11 lista para tu commit"**

---

### Task 12: Onboarding + shell de tabs

**Files:**
- Create: `app/onboarding.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx` (placeholder), `app/(tabs)/movimientos.tsx` (placeholder), `app/(tabs)/cuentas.tsx` (placeholder), `app/(tabs)/metas.tsx` (placeholder)

**Interfaces:**
- Consumes: `createAccount`, `accountSchema`, `setPrefs`, `requestNotificationPermission`, `rescheduleReminders`, `useLiveQuery`, `db`.
- Produces: gate de onboarding (sin cuentas → `/onboarding`); tabs Dashboard/Movimientos/Cuentas/Metas con placeholders que las Tasks 13-17 reemplazan.

- [ ] **Step 1: Implementar el gate y el tab bar**

`app/(tabs)/_layout.tsx`:
```tsx
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Redirect, Tabs, router } from 'expo-router';
import { ChartPie, List, PiggyBank, Plus, Wallet } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { db } from '../../db/client';
import { accounts } from '../../db/schema';

export default function TabsLayout() {
  const { data: accs } = useLiveQuery(db.select({ id: accounts.id }).from(accounts));

  if (accs && accs.length === 0) return <Redirect href="/onboarding" />;

  return (
    <>
      <Tabs screenOptions={{ tabBarActiveTintColor: '#059669' }}>
        <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <ChartPie color={color} size={size} /> }} />
        <Tabs.Screen name="movimientos" options={{ title: 'Movimientos', tabBarIcon: ({ color, size }) => <List color={color} size={size} /> }} />
        <Tabs.Screen name="cuentas" options={{ title: 'Cuentas', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
        <Tabs.Screen name="metas" options={{ title: 'Metas', tabBarIcon: ({ color, size }) => <PiggyBank color={color} size={size} /> }} />
      </Tabs>
      <Pressable
        onPress={() => router.push('/movimiento/nuevo')}
        className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-full bg-emerald-600 shadow-lg"
      >
        <Plus color="white" size={28} />
      </Pressable>
    </>
  );
}
```

- [ ] **Step 2: Implementar onboarding**

`app/onboarding.tsx`:
```tsx
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Field } from '../components/ui/Field';
import { db } from '../db/client';
import { createAccount } from '../db/repos/accounts';
import { rescheduleReminders, requestNotificationPermission } from '../lib/notifications';
import { setPrefs } from '../lib/prefs';
import { accountSchema } from '../lib/validation';

const TIPOS = [
  { value: 'debito', label: 'Débito' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
] as const;

const HORAS = [7, 12, 18, 20, 21, 22];

export default function Onboarding() {
  const [name, setName] = useState('');
  const [type, setType] = useState<'debito' | 'ahorro' | 'efectivo'>('debito');
  const [balanceText, setBalanceText] = useState('');
  const [hour, setHour] = useState(21);
  const [error, setError] = useState('');

  async function onStart() {
    const parsed = accountSchema.safeParse({ name, type, initialBalance: parseInt(balanceText || '0', 10) });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      createAccount(db, parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando la cuenta');
      return;
    }
    setPrefs({ reminderHour: hour, reminderMinute: 0 });
    const granted = await requestNotificationPermission();
    if (granted) await rescheduleReminders({ loggedToday: false, streak: 0 });
    router.replace('/(tabs)');
  }

  return (
    <ScrollView className="flex-1 bg-white p-6 dark:bg-neutral-950" contentContainerClassName="pb-12">
      <Text className="mb-1 mt-10 text-3xl font-bold text-neutral-900 dark:text-white">¡Hola! 👋</Text>
      <Text className="mb-6 text-neutral-500 dark:text-neutral-400">Crea tu primera cuenta para empezar a registrar.</Text>

      <Field label="Nombre de la cuenta" value={name} onChangeText={setName} placeholder="Ej: Bancolombia, Efectivo…" />
      <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Tipo</Text>
      <View className="mb-3 flex-row flex-wrap">
        {TIPOS.map((t) => (
          <Chip key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </View>
      <Field label="Saldo actual (COP)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />

      <Text className="mb-1 mt-4 text-sm text-neutral-500 dark:text-neutral-400">¿A qué hora te recordamos registrar?</Text>
      <View className="mb-6 flex-row flex-wrap">
        {HORAS.map((h) => (
          <Chip key={h} label={`${h}:00`} selected={hour === h} onPress={() => setHour(h)} />
        ))}
      </View>

      {error ? <Text className="mb-3 text-red-500">{error}</Text> : null}
      <Button label="Empezar" onPress={onStart} />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Placeholders de tabs** (mismo patrón para los cuatro archivos, cambiando el texto)

`app/(tabs)/index.tsx` (igual estructura para `movimientos.tsx`, `cuentas.tsx`, `metas.tsx`):
```tsx
import { Text, View } from 'react-native';

export default function Dashboard() {
  return (
    <View className="flex-1 items-center justify-center bg-neutral-100 dark:bg-neutral-950">
      <Text className="text-neutral-500">Dashboard — en construcción</Text>
    </View>
  );
}
```

- [ ] **Step 4: Verificación manual en Expo Go**

1. Borrar la app de Expo Go si había datos previos (o reinstalar) para partir de DB vacía.
2. Al abrir: aparece el onboarding. Crear cuenta "Bancolombia", débito, 500000, hora 21:00 → pide permiso de notificaciones → aterriza en tabs.
3. Cerrar y reabrir: ya NO aparece onboarding (hay cuenta creada).
4. Los 4 tabs navegan; el botón `+` abre una ruta inexistente todavía (error esperado hasta Task 13).

- [ ] **Step 5: `npm run typecheck` y `npm test` → verdes. Checkpoint — "Tarea 12 lista para tu commit"**

---

### Task 13: Modal de nuevo movimiento + "Hoy no gasté"

**Files:**
- Create: `app/movimiento/nuevo.tsx`, `components/CategoryGrid.tsx`

**Interfaces:**
- Consumes: `createTransaction`, `logToday`, `makeTransactionSchema`, `useLiveQuery`, `Chip`, `Button`, `Field`, `rescheduleReminders`, `displayStreak`.
- Produces: modal completo de registro; componente `<CategoryGrid kind selectedId onSelect />` reutilizado por la pantalla de edición (Task 15).

- [ ] **Step 1: Implementar CategoryGrid**

`components/CategoryGrid.tsx`:
```tsx
import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { icons } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { db } from '../db/client';
import { categories } from '../db/schema';

type Props = { kind: 'gasto' | 'ingreso'; selectedId: number | null; onSelect: (id: number) => void };

export function CategoryGrid({ kind, selectedId, onSelect }: Props) {
  const { data } = useLiveQuery(
    db.select().from(categories).where(and(eq(categories.kind, kind), isNull(categories.archivedAt))),
    [kind],
  );

  return (
    <View className="flex-row flex-wrap">
      {(data ?? []).map((cat) => {
        const Icon = icons[cat.icon as keyof typeof icons] ?? icons.Circle;
        const selected = selectedId === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            className={`mb-3 w-1/4 items-center ${selected ? 'opacity-100' : 'opacity-60'}`}
          >
            <View
              className={`h-12 w-12 items-center justify-center rounded-full ${selected ? 'border-2 border-emerald-600' : ''}`}
              style={{ backgroundColor: `${cat.color}33` }}
            >
              <Icon color={cat.color} size={22} />
            </View>
            <Text className="mt-1 text-center text-xs text-neutral-700 dark:text-neutral-300" numberOfLines={1}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: Implementar el modal**

`app/movimiento/nuevo.tsx`:
```tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { CategoryGrid } from '../../components/CategoryGrid';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts } from '../../db/schema';
import { displayStreak, logToday } from '../../db/repos/streak';
import { createTransaction } from '../../db/repos/transactions';
import { addDaysISO, todayISO } from '../../lib/dates';
import { rescheduleReminders } from '../../lib/notifications';
import { makeTransactionSchema } from '../../lib/validation';

const KINDS = [
  { value: 'gasto', label: 'Gasto' },
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'transferencia', label: 'Transferencia' },
] as const;

export default function NuevoMovimiento() {
  const today = todayISO();
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));

  const [kind, setKind] = useState<'gasto' | 'ingreso' | 'transferencia'>('gasto');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');

  async function afterLog(streakState: { currentStreak: number; bestStreak: number; lastLoggedDate: string | null }) {
    await rescheduleReminders({ loggedToday: true, streak: displayStreak(streakState, today) }).catch(() => {});
  }

  async function onNoSpend() {
    const state = logToday(db, today);
    await afterLog(state);
    Alert.alert('¡Listo!', `Día registrado. Racha: ${state.currentStreak} 🔥`);
    router.back();
  }

  async function onSave() {
    const candidate = {
      kind,
      amount: parseInt(amountText, 10),
      date,
      accountId: accountId ?? undefined,
      toAccountId: toAccountId ?? undefined,
      categoryId: categoryId ?? undefined,
      note: note || undefined,
    };
    const parsed = makeTransactionSchema(today).safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      createTransaction(db, parsed.data, today);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando');
      return;
    }
    if (date === today) {
      const { ensureAppState } = await import('../../db/repos/streak');
      await afterLog(ensureAppState(db));
    }
    router.back();
  }

  const cuentaLabel = kind === 'ingreso' ? 'Cuenta destino' : kind === 'transferencia' ? 'Cuenta origen' : 'Cuenta';

  return (
    <ScrollView className="flex-1 bg-white p-4 dark:bg-neutral-950" contentContainerClassName="pb-12">
      <View className="mb-4 flex-row">
        {KINDS.map((k) => (
          <Chip key={k.value} label={k.label} selected={kind === k.value} onPress={() => { setKind(k.value); setCategoryId(null); }} />
        ))}
      </View>

      <Field label="Monto (COP)" value={amountText} onChangeText={setAmountText} keyboardType="numeric" placeholder="0" />

      <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Fecha</Text>
      <View className="mb-3 flex-row">
        <Chip label="Hoy" selected={date === today} onPress={() => setDate(today)} />
        <Chip label="Ayer" selected={date === addDaysISO(today, -1)} onPress={() => setDate(addDaysISO(today, -1))} />
        <Chip label={`📅 ${date}`} selected={date !== today && date !== addDaysISO(today, -1)} onPress={() => setShowPicker(true)} />
      </View>
      {showPicker ? (
        <DateTimePicker
          value={new Date(`${date}T12:00:00`)}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setShowPicker(false);
            if (d) setDate(todayISO(d));
          }}
        />
      ) : null}

      <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">{cuentaLabel}</Text>
      <View className="mb-3 flex-row flex-wrap">
        {(accs ?? []).map((a) => (
          <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </View>

      {kind === 'transferencia' ? (
        <>
          <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Cuenta destino</Text>
          <View className="mb-3 flex-row flex-wrap">
            {(accs ?? []).map((a) => (
              <Chip key={a.id} label={a.name} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Categoría</Text>
          <CategoryGrid kind={kind} selectedId={categoryId} onSelect={setCategoryId} />
        </>
      )}

      <Field label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="Ej: almuerzo con Ana" />

      {error ? <Text className="mb-3 text-red-500">{error}</Text> : null}
      <Button label="Guardar" onPress={onSave} />
      <View className="h-3" />
      <Button label="Hoy no gasté 🙌" variant="ghost" onPress={onNoSpend} />
    </ScrollView>
  );
}
```

Nota de implementación: el spec pide React Hook Form; este formulario usa controles 100% custom (chips, grid) donde RHF solo añadiría `setValue`/`watch` alrededor de cada uno. La validación Zod se aplica íntegra en `onSave`. Si el implementador prefiere fidelidad literal al spec, envolver estos estados en `useForm` + `zodResolver` es un cambio local a este archivo; el resto del plan no depende de ello.

- [ ] **Step 3: Verificación manual en Expo Go**

1. Tocar `+` → abre el modal.
2. Guardar un gasto de hoy (monto 25000, categoría Mercado) → cierra y no crashea. Volver a abrir y tocar "Hoy no gasté" → alerta con racha 1 (mismo día, idempotente).
3. Transferencia con misma cuenta origen/destino → muestra error en español.
4. Monto vacío o 0 → error. Fecha "Ayer" → guarda sin tocar racha.

- [ ] **Step 4: `npm run typecheck` y `npm test` → verdes. Checkpoint — "Tarea 13 lista para tu commit"**

---

### Task 14: Dashboard con gráficas

**Files:**
- Modify: `app/(tabs)/index.tsx` (reemplazar placeholder)
- Create: `components/MonthSelector.tsx`

**Interfaces:**
- Consumes: `useLiveQuery` sobre `transactions`/`categories`/`accounts`/`savingsGoals`/`appState`; `monthSummary`, `expensesByCategory`, `balanceByMonth`, `goalProgress`, `displayStreak`; `useUI`; `formatCOP`; `monthLabel`, `shiftMonth`, `lastNMonths`; `PieChart`/`LineChart` de `react-native-gifted-charts`.
- Produces: `<MonthSelector />` (usa `useUI`; reutilizado en Movimientos).

- [ ] **Step 0: Antes de escribir el código de las gráficas, invocar la skill `dataviz`** y aplicar sus lineamientos (los colores de la dona vienen de la paleta de categorías del usuario; la línea usa un solo color de acento).

- [ ] **Step 1: Implementar MonthSelector**

`components/MonthSelector.tsx`:
```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { monthLabel, monthOf, shiftMonth, todayISO } from '../lib/dates';
import { useUI } from '../store/ui';

export function MonthSelector() {
  const { selectedMonth, setMonth } = useUI();
  const currentMonth = monthOf(todayISO());
  return (
    <View className="flex-row items-center justify-center py-2">
      <Pressable onPress={() => setMonth(shiftMonth(selectedMonth, -1))} className="p-2">
        <ChevronLeft size={20} color="#737373" />
      </Pressable>
      <Text className="w-32 text-center font-semibold text-neutral-900 dark:text-white">{monthLabel(selectedMonth)}</Text>
      <Pressable
        onPress={() => setMonth(shiftMonth(selectedMonth, 1))}
        disabled={selectedMonth >= currentMonth}
        className={`p-2 ${selectedMonth >= currentMonth ? 'opacity-30' : ''}`}
      >
        <ChevronRight size={20} color="#737373" />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Implementar el Dashboard**

`app/(tabs)/index.tsx`:
```tsx
import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { Flame, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { MonthSelector } from '../../components/MonthSelector';
import { Card } from '../../components/ui/Card';
import { db } from '../../db/client';
import { accounts, appState, categories, savingsGoals, transactions } from '../../db/schema';
import { displayStreak } from '../../db/repos/streak';
import { balanceByMonth, expensesByCategory, goalProgress, monthSummary } from '../../lib/calc';
import { lastNMonths, monthLabel, todayISO } from '../../lib/dates';
import { formatCOP } from '../../lib/money';
import { useUI } from '../../store/ui';

export default function Dashboard() {
  const today = todayISO();
  const { selectedMonth, setCategoryFilter } = useUI();
  const { data: txs } = useLiveQuery(db.select().from(transactions));
  const { data: cats } = useLiveQuery(db.select().from(categories));
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: goals } = useLiveQuery(db.select().from(savingsGoals).where(isNull(savingsGoals.archivedAt)));
  const { data: stateRows } = useLiveQuery(db.select().from(appState));

  const allTx = txs ?? [];
  const summary = monthSummary(allTx, selectedMonth);
  const donut = expensesByCategory(allTx, cats ?? [], selectedMonth);
  const months = lastNMonths(6, today);
  const evolution = balanceByMonth(allTx, months);
  const monthsWithData = new Set(allTx.map((t) => t.date.slice(0, 7)));
  const streak = stateRows?.[0] ? displayStreak(stateRows[0], today) : 0;

  return (
    <ScrollView className="flex-1 bg-neutral-100 dark:bg-neutral-950" contentContainerClassName="p-4 pb-28">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Flame size={22} color="#f97316" />
          <Text className="ml-1 text-lg font-bold text-neutral-900 dark:text-white">
            {streak} {streak === 1 ? 'día' : 'días'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/ajustes')} className="p-2">
          <Settings size={22} color="#737373" />
        </Pressable>
      </View>

      <MonthSelector />

      <Card className="mb-4">
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">Balance del mes</Text>
        <Text className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCOP(summary.balance)}</Text>
        <View className="mt-2 flex-row justify-between">
          <Text className="text-emerald-600">↑ {formatCOP(summary.ingresos)}</Text>
          <Text className="text-red-500">↓ {formatCOP(summary.gastos)}</Text>
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-semibold text-neutral-900 dark:text-white">Gastos por categoría</Text>
        {donut.length === 0 ? (
          <Text className="text-neutral-500">Sin gastos este mes. ¡Registra el primero con el botón +!</Text>
        ) : (
          <View className="flex-row items-center">
            <PieChart
              data={donut.map((d) => ({ value: d.total, color: d.color }))}
              donut
              radius={70}
              innerRadius={45}
              centerLabelComponent={() => <Text className="text-xs text-neutral-500">{formatCOP(summary.gastos)}</Text>}
            />
            <View className="ml-4 flex-1">
              {donut.map((d) => (
                <Pressable
                  key={`${d.categoryId}`}
                  className="mb-1 flex-row items-center"
                  onPress={() => {
                    if (d.categoryId != null) {
                      setCategoryFilter(d.categoryId);
                      router.push('/(tabs)/movimientos');
                    }
                  }}
                >
                  <View className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <Text className="flex-1 text-xs text-neutral-700 dark:text-neutral-300" numberOfLines={1}>{d.name}</Text>
                  <Text className="text-xs text-neutral-500">{formatCOP(d.total)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-semibold text-neutral-900 dark:text-white">Evolución (6 meses)</Text>
        {monthsWithData.size < 2 ? (
          <Text className="text-neutral-500">Cuando tengas al menos 2 meses de datos verás tu evolución aquí.</Text>
        ) : (
          <LineChart
            data={evolution.map((e) => ({ value: e.balance, label: monthLabel(e.month).slice(0, 3) }))}
            height={140}
            color="#059669"
            thickness={2}
            hideDataPoints={false}
            dataPointsColor="#059669"
            yAxisTextStyle={{ color: '#737373', fontSize: 10 }}
            xAxisLabelTextStyle={{ color: '#737373', fontSize: 10 }}
            noOfSections={4}
            areaChart
            startFillColor="#05966922"
            endFillColor="#05966900"
          />
        )}
      </Card>

      {(goals ?? []).length > 0 ? (
        <Card>
          <Text className="mb-2 font-semibold text-neutral-900 dark:text-white">Metas</Text>
          {(goals ?? []).map((g) => {
            const progress = goalProgress(g, accs ?? [], allTx);
            const pct = Math.min(100, Math.round((progress / g.targetAmount) * 100));
            return (
              <View key={g.id} className="mb-3">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-neutral-700 dark:text-neutral-300">{g.name}</Text>
                  <Text className="text-sm text-neutral-500">{pct}%</Text>
                </View>
                <View className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <View className="h-2 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Verificación manual en Expo Go**

1. Registrar 2-3 gastos en distintas categorías y 1 ingreso → el balance, la dona y la leyenda se actualizan **sin recargar**.
2. Tocar un segmento/fila de la dona → navega a Movimientos (placeholder por ahora) con el filtro seteado.
3. Cambiar de mes con ‹ › → los números cambian; el chevron derecho se deshabilita en el mes actual.
4. La racha del encabezado coincide con lo registrado hoy.

- [ ] **Step 4: `npm run typecheck` y `npm test` → verdes. Checkpoint — "Tarea 14 lista para tu commit"**

---

### Task 15: Lista de movimientos + detalle/edición

**Files:**
- Modify: `app/(tabs)/movimientos.tsx` (reemplazar placeholder)
- Create: `app/movimiento/[id].tsx`

**Interfaces:**
- Consumes: `useUI` (mes + filtro de categoría), `MonthSelector`, `updateTransaction`, `deleteTransaction`, `CategoryGrid`, `makeTransactionSchema`, `formatCOP`.
- Produces: nada nuevo para otras tareas.

- [ ] **Step 1: Implementar la lista**

`app/(tabs)/movimientos.tsx`:
```tsx
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { desc } from 'drizzle-orm';
import { router } from 'expo-router';
import { ArrowLeftRight, X, icons } from 'lucide-react-native';
import { FlatList, Pressable, Text, View } from 'react-native';
import { MonthSelector } from '../../components/MonthSelector';
import { db } from '../../db/client';
import { categories, transactions } from '../../db/schema';
import { formatCOP } from '../../lib/money';
import { useUI } from '../../store/ui';

export default function Movimientos() {
  const { selectedMonth, categoryFilter, setCategoryFilter } = useUI();
  const { data: txs } = useLiveQuery(db.select().from(transactions).orderBy(desc(transactions.date), desc(transactions.id)));
  const { data: cats } = useLiveQuery(db.select().from(categories));

  const filtered = (txs ?? []).filter(
    (t) => t.date.startsWith(selectedMonth) && (categoryFilter == null || t.categoryId === categoryFilter),
  );
  const filterName = categoryFilter != null ? (cats ?? []).find((c) => c.id === categoryFilter)?.name : null;

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-950">
      <MonthSelector />
      {filterName ? (
        <Pressable
          onPress={() => setCategoryFilter(null)}
          className="mx-4 mb-2 flex-row items-center self-start rounded-full bg-emerald-100 px-3 py-1 dark:bg-emerald-950"
        >
          <Text className="mr-1 text-sm text-emerald-700 dark:text-emerald-400">{filterName}</Text>
          <X size={14} color="#059669" />
        </Pressable>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(t) => String(t.id)}
        contentContainerClassName="px-4 pb-28"
        ListEmptyComponent={<Text className="mt-10 text-center text-neutral-500">No hay movimientos con este filtro.</Text>}
        renderItem={({ item: t }) => {
          const cat = (cats ?? []).find((c) => c.id === t.categoryId);
          const Icon = t.kind === 'transferencia' ? ArrowLeftRight : (icons[cat?.icon as keyof typeof icons] ?? icons.Circle);
          const color = t.kind === 'transferencia' ? '#737373' : (cat?.color ?? '#737373');
          const amountColor = t.kind === 'ingreso' ? 'text-emerald-600' : t.kind === 'gasto' ? 'text-red-500' : 'text-neutral-500';
          const sign = t.kind === 'ingreso' ? '+' : t.kind === 'gasto' ? '-' : '';
          return (
            <Pressable
              onPress={() => router.push(`/movimiento/${t.id}`)}
              className="mb-2 flex-row items-center rounded-2xl bg-white p-3 dark:bg-neutral-900"
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${color}33` }}>
                <Icon color={color} size={18} />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-neutral-900 dark:text-white">
                  {t.kind === 'transferencia' ? 'Transferencia' : (cat?.name ?? 'Sin categoría')}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {t.date}
                  {t.note ? ` · ${t.note}` : ''}
                </Text>
              </View>
              <Text className={`font-semibold ${amountColor}`}>{sign}{formatCOP(t.amount)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2: Implementar detalle/edición**

`app/movimiento/[id].tsx`:
```tsx
import DateTimePicker from '@react-native-community/datetimepicker';
import { eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { CategoryGrid } from '../../components/CategoryGrid';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, transactions } from '../../db/schema';
import { deleteTransaction, updateTransaction } from '../../db/repos/transactions';
import { todayISO } from '../../lib/dates';
import { makeTransactionSchema } from '../../lib/validation';

export default function DetalleMovimiento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = Number(id);
  const today = todayISO();
  const { data: rows } = useLiveQuery(db.select().from(transactions).where(eq(transactions.id, txId)), [txId]);
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const tx = rows?.[0];

  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (tx && !loaded) {
      setAmountText(String(tx.amount));
      setDate(tx.date);
      setAccountId(tx.accountId);
      setToAccountId(tx.toAccountId);
      setCategoryId(tx.categoryId);
      setNote(tx.note ?? '');
      setLoaded(true);
    }
  }, [tx, loaded]);

  if (!tx) return null;

  function onSave() {
    const parsed = makeTransactionSchema(today).safeParse({
      kind: tx!.kind,
      amount: parseInt(amountText, 10),
      date,
      accountId: accountId ?? undefined,
      toAccountId: toAccountId ?? undefined,
      categoryId: categoryId ?? undefined,
      note: note || undefined,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      const { kind: _kind, ...patch } = parsed.data;
      updateTransaction(db, txId, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando');
      return;
    }
    router.back();
  }

  function onDelete() {
    Alert.alert('Borrar movimiento', '¿Seguro? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(db, txId);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView className="flex-1 bg-white p-4 dark:bg-neutral-950" contentContainerClassName="pb-12">
      <Text className="mb-3 text-center text-sm text-neutral-500">
        {tx.kind === 'gasto' ? 'Gasto' : tx.kind === 'ingreso' ? 'Ingreso' : 'Transferencia'} · el tipo no se puede cambiar
      </Text>
      <Field label="Monto (COP)" value={amountText} onChangeText={setAmountText} keyboardType="numeric" />

      <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Fecha</Text>
      <Chip label={`📅 ${date}`} selected onPress={() => setShowPicker(true)} />
      {showPicker ? (
        <DateTimePicker
          value={new Date(`${date}T12:00:00`)}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setShowPicker(false);
            if (d) setDate(todayISO(d));
          }}
        />
      ) : null}

      <Text className="mb-1 mt-3 text-sm text-neutral-500 dark:text-neutral-400">{tx.kind === 'ingreso' ? 'Cuenta destino' : 'Cuenta origen'}</Text>
      <View className="mb-3 flex-row flex-wrap">
        {(accs ?? []).map((a) => (
          <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </View>

      {tx.kind === 'transferencia' ? (
        <>
          <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Cuenta destino</Text>
          <View className="mb-3 flex-row flex-wrap">
            {(accs ?? []).map((a) => (
              <Chip key={a.id} label={a.name} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Categoría</Text>
          <CategoryGrid kind={tx.kind as 'gasto' | 'ingreso'} selectedId={categoryId} onSelect={setCategoryId} />
        </>
      )}

      <Field label="Nota (opcional)" value={note} onChangeText={setNote} />
      {error ? <Text className="mb-3 text-red-500">{error}</Text> : null}
      <Button label="Guardar cambios" onPress={onSave} />
      <View className="h-3" />
      <Button label="Borrar movimiento" variant="danger" onPress={onDelete} />
    </ScrollView>
  );
}
```

- [ ] **Step 3: Verificación manual en Expo Go**

1. La lista muestra los movimientos del mes seleccionado, más reciente primero, con signo y color por tipo.
2. Llegar desde la dona del dashboard → aparece el chip del filtro; tocar la X lo quita.
3. Tocar un movimiento → editar monto → guardar → la lista y el dashboard reflejan el cambio al instante.
4. Borrar un movimiento → pide confirmación → desaparece y los saldos se recalculan.

- [ ] **Step 4: `npm run typecheck` y `npm test` → verdes. Checkpoint — "Tarea 15 lista para tu commit"**

---

### Task 16: Pantalla de cuentas

**Files:**
- Modify: `app/(tabs)/cuentas.tsx` (reemplazar placeholder)

**Interfaces:**
- Consumes: `accountBalance`, `createAccount`, `removeAccount`, `accountSchema`, `formatCOP`.
- Produces: nada nuevo.

- [ ] **Step 1: Implementar**

`app/(tabs)/cuentas.tsx`:
```tsx
import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, transactions } from '../../db/schema';
import { createAccount, removeAccount } from '../../db/repos/accounts';
import { accountBalance } from '../../lib/calc';
import { formatCOP } from '../../lib/money';
import { accountSchema } from '../../lib/validation';

const TIPOS = [
  { value: 'debito', label: 'Débito' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
] as const;

export default function Cuentas() {
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: txs } = useLiveQuery(db.select().from(transactions));
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'debito' | 'ahorro' | 'efectivo'>('debito');
  const [balanceText, setBalanceText] = useState('');
  const [error, setError] = useState('');

  function onCreate() {
    const parsed = accountSchema.safeParse({ name, type, initialBalance: parseInt(balanceText || '0', 10) });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      createAccount(db, parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      return;
    }
    setModalOpen(false);
    setName('');
    setBalanceText('');
    setError('');
  }

  function onRemove(id: number, accName: string) {
    Alert.alert(`Eliminar "${accName}"`, 'Si tiene movimientos se archivará para conservar el historial.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeAccount(db, id) },
    ]);
  }

  return (
    <View className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <FlatList
        data={accs ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerClassName="pb-28"
        renderItem={({ item: a }) => {
          const bal = accountBalance(a, txs ?? []);
          return (
            <Pressable onLongPress={() => onRemove(a.id, a.name)} className="mb-2 rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-medium text-neutral-900 dark:text-white">{a.name}</Text>
                  <Text className="text-xs capitalize text-neutral-500">{a.type}</Text>
                </View>
                <Text className={`text-lg font-semibold ${bal < 0 ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>{formatCOP(bal)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={<Button label="+ Nueva cuenta" variant="ghost" onPress={() => setModalOpen(true)} />}
      />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white p-6 dark:bg-neutral-900">
            <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Nueva cuenta</Text>
            <Field label="Nombre" value={name} onChangeText={setName} />
            <View className="mb-3 flex-row">
              {TIPOS.map((t) => (
                <Chip key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
              ))}
            </View>
            <Field label="Saldo inicial (COP)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />
            {error ? <Text className="mb-2 text-red-500">{error}</Text> : null}
            <Button label="Crear" onPress={onCreate} />
            <View className="h-2" />
            <Button label="Cancelar" variant="ghost" onPress={() => setModalOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: Verificación manual**

1. La cuenta del onboarding aparece con su saldo (inicial ± movimientos registrados).
2. Crear una segunda cuenta → aparece al instante; nombre duplicado → error.
3. Registrar una transferencia entre ambas → los dos saldos cambian correctamente.
4. Long-press en una cuenta con movimientos → confirmar → desaparece (archivada) y el historial sigue en Movimientos. Long-press en una sin movimientos → se borra.

- [ ] **Step 3: `npm run typecheck` y `npm test` → verdes. Checkpoint — "Tarea 16 lista para tu commit"**

---

### Task 17: Pantalla de metas

**Files:**
- Modify: `app/(tabs)/metas.tsx` (reemplazar placeholder)

**Interfaces:**
- Consumes: `createGoal`, `addToGoal`, `archiveGoal`, `goalProgress`, `goalSchema`, `formatCOP`.
- Produces: nada nuevo.

- [ ] **Step 1: Implementar**

`app/(tabs)/metas.tsx`:
```tsx
import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { FlatList, Modal, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, savingsGoals, transactions } from '../../db/schema';
import { addToGoal, archiveGoal, createGoal } from '../../db/repos/goals';
import { goalProgress } from '../../lib/calc';
import { formatCOP } from '../../lib/money';
import { goalSchema } from '../../lib/validation';

export default function Metas() {
  const { data: goals } = useLiveQuery(db.select().from(savingsGoals).where(isNull(savingsGoals.archivedAt)));
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: txs } = useLiveQuery(db.select().from(transactions));

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [abonarGoalId, setAbonarGoalId] = useState<number | null>(null);
  const [abonoText, setAbonoText] = useState('');
  const [abonoError, setAbonoError] = useState('');

  function onCreate() {
    const parsed = goalSchema.safeParse({ name, targetAmount: parseInt(targetText || '0', 10), accountId: linkedAccountId });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    createGoal(db, parsed.data);
    setCreateOpen(false);
    setName('');
    setTargetText('');
    setLinkedAccountId(null);
    setError('');
  }

  function onAbonar() {
    try {
      addToGoal(db, abonarGoalId!, parseInt(abonoText || '0', 10));
      setAbonarGoalId(null);
      setAbonoText('');
      setAbonoError('');
    } catch (e) {
      setAbonoError(e instanceof Error ? e.message : 'Error');
    }
  }

  return (
    <View className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <FlatList
        data={goals ?? []}
        keyExtractor={(g) => String(g.id)}
        contentContainerClassName="pb-28"
        ListEmptyComponent={<Text className="mt-10 text-center text-neutral-500">Crea tu primera meta de ahorro 🎯</Text>}
        renderItem={({ item: g }) => {
          const progress = goalProgress(g, accs ?? [], txs ?? []);
          const pct = Math.min(100, Math.round((progress / g.targetAmount) * 100));
          const done = progress >= g.targetAmount;
          return (
            <View className="mb-3 rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <View className="flex-row items-center justify-between">
                <Text className="font-medium text-neutral-900 dark:text-white">{g.name}</Text>
                {done ? <Text className="font-semibold text-emerald-600">¡Cumplida! 🎉</Text> : <Text className="text-neutral-500">{pct}%</Text>}
              </View>
              <View className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <View className="h-2 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
              </View>
              <Text className="mt-1 text-xs text-neutral-500">
                {formatCOP(progress)} de {formatCOP(g.targetAmount)}
                {g.accountId != null ? ' · sigue el saldo de una cuenta' : ''}
              </Text>
              <View className="mt-2 flex-row">
                {g.accountId == null && !done ? <Button label="Abonar" variant="ghost" onPress={() => setAbonarGoalId(g.id)} /> : null}
                {done ? <Button label="Archivar" variant="ghost" onPress={() => archiveGoal(db, g.id)} /> : null}
              </View>
            </View>
          );
        }}
        ListFooterComponent={<Button label="+ Nueva meta" variant="ghost" onPress={() => setCreateOpen(true)} />}
      />

      <Modal visible={createOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white p-6 dark:bg-neutral-900">
            <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Nueva meta</Text>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Viaje a San Andrés" />
            <Field label="Monto objetivo (COP)" value={targetText} onChangeText={setTargetText} keyboardType="numeric" />
            <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Ligar a una cuenta (opcional)</Text>
            <View className="mb-3 flex-row flex-wrap">
              <Chip label="Manual" selected={linkedAccountId === null} onPress={() => setLinkedAccountId(null)} />
              {(accs ?? []).map((a) => (
                <Chip key={a.id} label={a.name} selected={linkedAccountId === a.id} onPress={() => setLinkedAccountId(a.id)} />
              ))}
            </View>
            {error ? <Text className="mb-2 text-red-500">{error}</Text> : null}
            <Button label="Crear" onPress={onCreate} />
            <View className="h-2" />
            <Button label="Cancelar" variant="ghost" onPress={() => setCreateOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={abonarGoalId != null} animationType="fade" transparent>
        <View className="flex-1 items-center justify-center bg-black/40 p-8">
          <View className="w-full rounded-2xl bg-white p-6 dark:bg-neutral-900">
            <Text className="mb-3 text-lg font-bold text-neutral-900 dark:text-white">Abonar a la meta</Text>
            <Field label="Monto (COP)" value={abonoText} onChangeText={setAbonoText} keyboardType="numeric" />
            {abonoError ? <Text className="mb-2 text-red-500">{abonoError}</Text> : null}
            <Button label="Abonar" onPress={onAbonar} />
            <View className="h-2" />
            <Button label="Cancelar" variant="ghost" onPress={() => setAbonarGoalId(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
```

- [ ] **Step 2: Verificación manual**

1. Crear meta manual "Viaje" de 1.000.000 → abonar 250.000 → barra al 25%.
2. Crear meta ligada a la cuenta de ahorro → transferirle plata desde débito → el progreso sube solo.
3. Completar una meta → aparece "¡Cumplida! 🎉" y el botón Archivar la quita de la lista.
4. Las tarjetas compactas del dashboard reflejan lo mismo.

- [ ] **Step 3: `npm run typecheck` y `npm test` → verdes. Checkpoint — "Tarea 17 lista para tu commit"**

---

### Task 18: Ajustes (recordatorio, tema, categorías)

**Files:**
- Create: `app/ajustes/index.tsx`, `app/ajustes/categorias.tsx`

**Interfaces:**
- Consumes: `getPrefs`/`setPrefs`, `rescheduleReminders`, `getNotificationPermissionStatus`, `createCategory`/`removeCategory`, `useColorScheme` de nativewind, `Linking.openSettings()`.
- Produces: nada nuevo.

- [ ] **Step 1: Implementar ajustes**

`app/ajustes/index.tsx`:
```tsx
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { db } from '../../db/client';
import { displayStreak, ensureAppState } from '../../db/repos/streak';
import { todayISO } from '../../lib/dates';
import { getNotificationPermissionStatus, rescheduleReminders, requestNotificationPermission } from '../../lib/notifications';
import { getPrefs, setPrefs, type Prefs } from '../../lib/prefs';

const HORAS = [7, 12, 18, 20, 21, 22];
const TEMAS = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const;

export default function Ajustes() {
  const [prefs, setPrefsState] = useState<Prefs>(getPrefs());
  const [permGranted, setPermGranted] = useState(true);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    getNotificationPermissionStatus().then(setPermGranted);
  }, []);

  async function update(patch: Partial<Prefs>) {
    const next = setPrefs(patch);
    setPrefsState(next);
    if (patch.theme) setColorScheme(patch.theme);
    const state = ensureAppState(db);
    const today = todayISO();
    await rescheduleReminders({ loggedToday: state.lastLoggedDate === today, streak: displayStreak(state, today) }).catch(() => {});
  }

  return (
    <ScrollView className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <View className="mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-neutral-900 dark:text-white">Recordatorio diario</Text>
          <Switch value={prefs.reminderEnabled} onValueChange={(v) => update({ reminderEnabled: v })} />
        </View>
        {prefs.reminderEnabled ? (
          <View className="mt-3 flex-row flex-wrap">
            {HORAS.map((h) => (
              <Chip key={h} label={`${h}:00`} selected={prefs.reminderHour === h} onPress={() => update({ reminderHour: h })} />
            ))}
          </View>
        ) : null}
        {!permGranted ? (
          <View className="mt-3">
            <Text className="mb-2 text-sm text-amber-600">Las notificaciones están desactivadas para la app.</Text>
            <Button
              label="Activar notificaciones"
              variant="ghost"
              onPress={async () => {
                const ok = await requestNotificationPermission();
                setPermGranted(ok);
                if (!ok) Linking.openSettings();
              }}
            />
          </View>
        ) : null}
      </View>

      <View className="mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900">
        <Text className="mb-2 font-medium text-neutral-900 dark:text-white">Tema</Text>
        <View className="flex-row">
          {TEMAS.map((t) => (
            <Chip key={t.value} label={t.label} selected={prefs.theme === t.value} onPress={() => update({ theme: t.value })} />
          ))}
        </View>
      </View>

      <Button label="Gestionar categorías" variant="ghost" onPress={() => router.push('/ajustes/categorias')} />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Implementar gestión de categorías**

`app/ajustes/categorias.tsx`:
```tsx
import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { icons } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { categories } from '../../db/schema';
import { createCategory, removeCategory } from '../../db/repos/categories';

const COLORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function Categorias() {
  const { data: cats } = useLiveQuery(db.select().from(categories).where(isNull(categories.archivedAt)));
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'gasto' | 'ingreso'>('gasto');
  const [color, setColor] = useState(COLORES[0]);
  const [error, setError] = useState('');

  function onCreate() {
    try {
      createCategory(db, { name, kind, icon: 'Tag', color });
      setFormOpen(false);
      setName('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  function onRemove(id: number, catName: string) {
    Alert.alert(`Eliminar "${catName}"`, 'Si tiene movimientos se archivará para conservar el historial.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeCategory(db, id) },
    ]);
  }

  return (
    <View className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <FlatList
        data={cats ?? []}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item: c }) => {
          const Icon = icons[c.icon as keyof typeof icons] ?? icons.Circle;
          return (
            <Pressable onLongPress={() => onRemove(c.id, c.name)} className="mb-2 flex-row items-center rounded-2xl bg-white p-3 dark:bg-neutral-900">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${c.color}33` }}>
                <Icon color={c.color} size={18} />
              </View>
              <Text className="flex-1 text-neutral-900 dark:text-white">{c.name}</Text>
              <Text className="text-xs capitalize text-neutral-500">{c.kind}</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          formOpen ? (
            <View className="rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <Field label="Nombre" value={name} onChangeText={setName} />
              <View className="mb-3 flex-row">
                <Chip label="Gasto" selected={kind === 'gasto'} onPress={() => setKind('gasto')} />
                <Chip label="Ingreso" selected={kind === 'ingreso'} onPress={() => setKind('ingreso')} />
              </View>
              <View className="mb-3 flex-row flex-wrap">
                {COLORES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className={`mr-2 h-8 w-8 rounded-full ${color === c ? 'border-2 border-neutral-900 dark:border-white' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </View>
              {error ? <Text className="mb-2 text-red-500">{error}</Text> : null}
              <Button label="Crear" onPress={onCreate} />
              <View className="h-2" />
              <Button label="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} />
            </View>
          ) : (
            <Button label="+ Nueva categoría" variant="ghost" onPress={() => setFormOpen(true)} />
          )
        }
      />
    </View>
  );
}
```

- [ ] **Step 3: Verificación manual (fin a fin de v1)**

1. Ajustes: apagar y encender el recordatorio; cambiar la hora a un minuto en el futuro cercano (probar temporalmente con una hora próxima) → llega la notificación local; tocarla abre el modal de nuevo movimiento.
2. Registrar un movimiento hoy y revisar (iOS: Ajustes del sistema > notificaciones programadas no visible — verificar comportamiento: tras registrar, la notificación de hoy ya no llega).
3. Cambiar tema a Oscuro → toda la app cambia; cerrar y reabrir → persiste.
4. Crear categoría "Mascotas" → aparece en el grid del modal de gasto. Archivar una usada → desaparece de selectores, el historial la sigue mostrando.
5. Pasada completa: onboarding → registrar gasto/ingreso/transferencia → dashboard correcto → editar → borrar → metas → racha.

- [ ] **Step 4: `npm run typecheck` y `npm test` → verdes. Checkpoint — "Tarea 18 lista para tu commit. v1 completa."**

---

## Autorevisión del plan (hecha)

- **Cobertura del spec:** registro (T13), dashboard + gráficas (T14), movimientos + edición (T15), cuentas (T16), metas (T17), racha (T5, T7, T13), notificaciones (T10, T18), onboarding + seed (T12, T6), migraciones (T2, T11), validación (T9), casos borde (T6-T9), tests unit (T2-T10). Sin huecos.
- **Placeholders:** ninguno; todo paso con código lo incluye completo.
- **Consistencia de tipos:** `DB`, `NewTransaction`, `StreakState`, `Prefs`, firmas de repos y calc verificadas entre tareas (los bloques *Interfaces* de cada tarea son la fuente).
- **Desviación consciente del spec:** el formulario de movimiento valida con Zod pero sin React Hook Form (justificado en T13); RHF queda como opción local si se quiere fidelidad literal.
