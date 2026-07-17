# Metas: Cálculo de Ahorro Mensual — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una meta de ahorro pueda tener una fecha objetivo opcional y la app calcule y muestre cuánto ahorrar por mes para cumplirla a tiempo, en la tarjeta y en un preview en vivo al crear/editar.

**Architecture:** Se agrega una columna nullable `target_date` a `savings_goals`. Una función pura `monthlyTarget` en `lib/calc.ts` deriva el estado (activa/completa/vencida/sin_fecha) y el monto mensual. La pantalla de Metas muestra el resultado en cada tarjeta y reutiliza su sheet para crear y editar (con selector de fecha y preview en vivo).

**Tech Stack:** Expo 57, expo-router, Drizzle ORM + expo-sqlite, NativeWind, Zod, Vitest, `@react-native-community/datetimepicker`.

## Global Constraints

- Dinero en enteros COP (sin decimales). Los montos se validan como `int` positivo.
- Fechas en formato ISO `YYYY-MM-DD` (string), nunca objetos `Date` en la BD.
- Las funciones de cálculo son puras y reciben `today` como parámetro (no llaman `new Date()` internamente) para ser testeables.
- Tests con Vitest: `npm test`. Typecheck: `npm run typecheck`.
- Migraciones Drizzle: tras cambiar `db/schema.ts`, generar con `npx drizzle-kit generate` y registrar el archivo nuevo en `drizzle/migrations.js` (mantenido a mano). Los tests aplican migraciones desde `./drizzle` vía `tests/helpers/testDb.ts`.

---

### Task 1: Columna `target_date` en savings_goals + migración

**Files:**
- Modify: `db/schema.ts:33-41` (tabla `savingsGoals`)
- Create: `drizzle/0001_<generado>.sql` (lo genera drizzle-kit)
- Modify: `drizzle/migrations.js`

**Interfaces:**
- Produces: el tipo `SavingsGoal` (inferido) gana `targetDate: string | null`.

- [ ] **Step 1: Agregar la columna al schema**

En `db/schema.ts`, dentro de `savingsGoals`, agregar `targetDate` después de `manualAmount`:

```ts
export const savingsGoals = sqliteTable('savings_goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  targetAmount: integer('target_amount').notNull(),
  accountId: integer('account_id').references(() => accounts.id),
  manualAmount: integer('manual_amount').notNull().default(0),
  targetDate: text('target_date'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
});
```

- [ ] **Step 2: Generar la migración**

Run: `npx drizzle-kit generate`
Expected: crea un archivo `drizzle/0001_*.sql` que contiene `ALTER TABLE savings_goals ADD COLUMN target_date text;` y actualiza `drizzle/meta`. Anota el nombre exacto del archivo generado.

- [ ] **Step 3: Registrar la migración en migrations.js**

`drizzle/migrations.js` se mantiene a mano para Expo. Agregar el import del archivo generado (sustituye `<generado>` por el nombre real del Step 2):

```js
import journal from './meta/_journal.json';
import m0000 from './0000_simple_eddie_brock.sql';
import m0001 from './0001_<generado>.sql';

  export default {
    journal,
    migrations: {
      m0000,
      m0001
    }
  }
```

- [ ] **Step 4: Verificar que la suite existente sigue pasando**

Run: `npm test`
Expected: PASS. Los tests usan `migrate(db, { migrationsFolder: './drizzle' })`; si la migración está bien registrada, todas las tablas (incluida la columna nueva) se crean sin error.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts drizzle/
git commit -m "feat(metas): columna target_date en savings_goals"
```

---

### Task 2: Helper `monthsBetween` en dates.ts

**Files:**
- Modify: `lib/dates.ts`
- Test: `tests/dates.test.ts`

**Interfaces:**
- Produces: `monthsBetween(from: string, to: string): number` — diferencia en meses entre dos `YYYY-MM` (o `YYYY-MM-DD`, se toma el prefijo año-mes). `to - from`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `tests/dates.test.ts`:

```ts
import { monthsBetween } from '../lib/dates';

describe('monthsBetween', () => {
  it('cuenta meses entre dos year-month', () => {
    expect(monthsBetween('2026-07', '2026-12')).toBe(5);
    expect(monthsBetween('2026-07', '2026-07')).toBe(0);
    expect(monthsBetween('2026-07', '2026-06')).toBe(-1);
    expect(monthsBetween('2025-11', '2026-02')).toBe(3);
  });
  it('ignora el día si recibe fechas completas', () => {
    expect(monthsBetween('2026-07-31', '2026-09-01')).toBe(2);
  });
});
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- dates`
Expected: FAIL con "monthsBetween is not a function" / import no resuelto.

- [ ] **Step 3: Implementar el helper**

Agregar al final de `lib/dates.ts`:

```ts
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
```

- [ ] **Step 4: Correr el test**

Run: `npm test -- dates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts tests/dates.test.ts
git commit -m "feat(dates): helper monthsBetween"
```

---

### Task 3: Función `monthlyTarget` en calc.ts

**Files:**
- Modify: `lib/calc.ts`
- Test: `tests/calc.test.ts`

**Interfaces:**
- Consumes: `monthsBetween` (Task 2), `monthOf` (existente en `lib/dates.ts`), tipo `SavingsGoal`.
- Produces:
  ```ts
  type MonthlyTarget =
    | { status: 'sin_fecha' }
    | { status: 'completa' }
    | { status: 'vencida'; remaining: number }
    | { status: 'activa'; perMonth: number; monthsLeft: number; targetDate: string };
  function monthlyTarget(goal: SavingsGoal, progress: number, today: string): MonthlyTarget
  ```

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/calc.test.ts` (reutiliza el helper `goal` ya definido en el `describe('goalProgress')`; para estos tests define uno local en un nuevo `describe`):

```ts
import { monthlyTarget } from '../lib/calc';

describe('monthlyTarget', () => {
  const goal = (p: Partial<SavingsGoal>): SavingsGoal =>
    ({ id: 1, name: 'Viaje', targetAmount: 1200000, accountId: null, manualAmount: 0, targetDate: null, archivedAt: null, createdAt: '', ...p }) as SavingsGoal;

  it('sin fecha objetivo → sin_fecha', () => {
    expect(monthlyTarget(goal({ targetDate: null }), 0, '2026-07-17')).toEqual({ status: 'sin_fecha' });
  });
  it('progreso >= objetivo → completa (aunque tenga fecha)', () => {
    expect(monthlyTarget(goal({ targetDate: '2026-12-31' }), 1200000, '2026-07-17')).toEqual({ status: 'completa' });
  });
  it('mes objetivo = mes actual → 1 mes, perMonth = restante', () => {
    expect(monthlyTarget(goal({ targetDate: '2026-07-31' }), 200000, '2026-07-17')).toEqual({
      status: 'activa', perMonth: 1000000, monthsLeft: 1, targetDate: '2026-07-31',
    });
  });
  it('varios meses → monthsLeft incluye el mes actual y perMonth usa ceil', () => {
    // hoy jul, meta dic → monthsLeft = (5)+1 = 6; restante 1200000 → 200000/mes
    expect(monthlyTarget(goal({ targetDate: '2026-12-31' }), 0, '2026-07-17')).toEqual({
      status: 'activa', perMonth: 200000, monthsLeft: 6, targetDate: '2026-12-31',
    });
  });
  it('restante no divisible → ceil', () => {
    // restante 100, 3 meses (hoy jul, meta sep) → ceil(100/3) = 34
    expect(monthlyTarget(goal({ targetAmount: 100, targetDate: '2026-09-10' }), 0, '2026-07-17')).toMatchObject({
      status: 'activa', perMonth: 34, monthsLeft: 3,
    });
  });
  it('mes objetivo ya pasó → vencida con restante', () => {
    expect(monthlyTarget(goal({ targetDate: '2026-06-30' }), 500000, '2026-07-17')).toEqual({
      status: 'vencida', remaining: 700000,
    });
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npm test -- calc`
Expected: FAIL con "monthlyTarget is not a function".

- [ ] **Step 3: Implementar la función**

En `lib/calc.ts`, agregar el import de `monthsBetween` y `monthOf`, y la función. En la línea 1 el import de tipos ya existe; agregar arriba:

```ts
import { monthOf, monthsBetween } from './dates';
```

Al final del archivo:

```ts
export type MonthlyTarget =
  | { status: 'sin_fecha' }
  | { status: 'completa' }
  | { status: 'vencida'; remaining: number }
  | { status: 'activa'; perMonth: number; monthsLeft: number; targetDate: string };

export function monthlyTarget(goal: SavingsGoal, progress: number, today: string): MonthlyTarget {
  if (progress >= goal.targetAmount) return { status: 'completa' };
  if (goal.targetDate == null) return { status: 'sin_fecha' };
  const remaining = goal.targetAmount - progress;
  const monthsLeft = monthsBetween(monthOf(today), monthOf(goal.targetDate)) + 1;
  if (monthsLeft <= 0) return { status: 'vencida', remaining };
  const perMonth = Math.ceil(remaining / monthsLeft);
  return { status: 'activa', perMonth, monthsLeft, targetDate: goal.targetDate };
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm test -- calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calc.ts tests/calc.test.ts
git commit -m "feat(metas): funcion monthlyTarget"
```

---

### Task 4: `targetDate` en goalSchema, createGoal y updateGoal

**Files:**
- Modify: `lib/validation.ts:39-43`
- Modify: `db/repos/goals.ts`
- Test: `tests/goals.test.ts`

**Interfaces:**
- Consumes: schema `savingsGoals` con `targetDate`.
- Produces:
  - `goalSchema` acepta `targetDate?: string | null`.
  - `createGoal(db, { name, targetAmount, accountId?, targetDate? })` persiste `targetDate`.
  - `updateGoal(db, id, patch: { name?: string; targetAmount?: number; targetDate?: string | null }): void`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/goals.test.ts` (importar `updateGoal`):

```ts
import { addToGoal, archiveGoal, createGoal, deleteGoal, updateGoal } from '../db/repos/goals';

describe('goals repo — targetDate y updateGoal', () => {
  it('crea meta con fecha objetivo', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000, targetDate: '2026-12-31' });
    expect(db.select().from(savingsGoals).all()[0].targetDate).toBe('2026-12-31');
    expect(id).toBeGreaterThan(0);
  });
  it('actualiza nombre, objetivo y fecha', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000 });
    updateGoal(db, id, { name: 'Viaje a San Andrés', targetAmount: 1500000, targetDate: '2027-01-31' });
    const row = db.select().from(savingsGoals).all()[0];
    expect(row.name).toBe('Viaje a San Andrés');
    expect(row.targetAmount).toBe(1500000);
    expect(row.targetDate).toBe('2027-01-31');
  });
  it('updateGoal puede quitar la fecha (null)', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000, targetDate: '2026-12-31' });
    updateGoal(db, id, { targetDate: null });
    expect(db.select().from(savingsGoals).all()[0].targetDate).toBeNull();
  });
  it('updateGoal valida nombre vacío y objetivo inválido', () => {
    const db = createTestDb();
    const id = createGoal(db, { name: 'Viaje', targetAmount: 1000000 });
    expect(() => updateGoal(db, id, { name: '  ' })).toThrow();
    expect(() => updateGoal(db, id, { targetAmount: 0 })).toThrow();
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npm test -- goals`
Expected: FAIL (updateGoal no existe; createGoal ignora targetDate).

- [ ] **Step 3: Actualizar el schema de validación**

En `lib/validation.ts`, reemplazar `goalSchema`:

```ts
export const goalSchema = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre'),
  targetAmount: amount,
  accountId: z.number().int().nullable().optional(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .nullable()
    .optional(),
});
```

- [ ] **Step 4: Actualizar createGoal y agregar updateGoal**

En `db/repos/goals.ts`, reemplazar `createGoal` y agregar `updateGoal`:

```ts
export function createGoal(
  db: DB,
  input: { name: string; targetAmount: number; accountId?: number | null; targetDate?: string | null },
): number {
  const clean = input.name.trim();
  if (!clean) throw new Error('El nombre no puede estar vacío');
  if (!Number.isInteger(input.targetAmount) || input.targetAmount <= 0) throw new Error('El objetivo debe ser un entero mayor que 0');
  const res = db
    .insert(savingsGoals)
    .values({
      name: clean,
      targetAmount: input.targetAmount,
      accountId: input.accountId ?? null,
      targetDate: input.targetDate ?? null,
      createdAt: new Date().toISOString(),
    })
    .run();
  return Number(res.lastInsertRowid);
}

export function updateGoal(
  db: DB,
  id: number,
  patch: { name?: string; targetAmount?: number; targetDate?: string | null },
): void {
  const set: Partial<{ name: string; targetAmount: number; targetDate: string | null }> = {};
  if (patch.name !== undefined) {
    const clean = patch.name.trim();
    if (!clean) throw new Error('El nombre no puede estar vacío');
    set.name = clean;
  }
  if (patch.targetAmount !== undefined) {
    if (!Number.isInteger(patch.targetAmount) || patch.targetAmount <= 0) throw new Error('El objetivo debe ser un entero mayor que 0');
    set.targetAmount = patch.targetAmount;
  }
  if (patch.targetDate !== undefined) set.targetDate = patch.targetDate;
  if (Object.keys(set).length === 0) return;
  db.update(savingsGoals).set(set).where(eq(savingsGoals.id, id)).run();
}
```

(El import de `eq` ya existe en la primera línea del archivo.)

- [ ] **Step 5: Correr los tests**

Run: `npm test -- goals`
Expected: PASS.

- [ ] **Step 6: Typecheck y commit**

Run: `npm run typecheck` → sin errores.

```bash
git add lib/validation.ts db/repos/goals.ts tests/goals.test.ts
git commit -m "feat(metas): targetDate en goalSchema, createGoal y updateGoal"
```

---

### Task 5: UI de Metas — display en tarjeta, crear/editar con fecha y preview

**Files:**
- Modify: `app/(tabs)/metas.tsx`

**Interfaces:**
- Consumes: `monthlyTarget` (Task 3), `updateGoal` y `createGoal` (Task 4), `monthLabel`/`monthOf`/`todayISO` (existentes en `lib/dates.ts`), `formatCOP`/`parseAmount` (existentes), `DateTimePicker` (ya usado en `nuevo.tsx`).

Esta task es de UI; se verifica con typecheck y ejecución manual (no hay tests de componentes en el repo).

- [ ] **Step 1: Actualizar imports y estado del formulario**

En `app/(tabs)/metas.tsx`, reemplazar los imports relevantes y el bloque de estado. Imports:

```ts
import DateTimePicker from '@react-native-community/datetimepicker';
import { monthlyTarget } from '../../lib/calc';
import { monthLabel, monthOf, todayISO } from '../../lib/dates';
import { addToGoal, archiveGoal, createGoal, deleteGoal, updateGoal } from '../../db/repos/goals';
```

Reemplazar el bloque de estado del formulario (líneas ~26-30) por uno que soporta crear y editar:

```ts
  const today = todayISO();
  const [formGoalId, setFormGoalId] = useState<number | null>(null); // null = cerrado
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
```

(Eliminar el antiguo `const [createOpen, setCreateOpen] = useState(false);`.)

- [ ] **Step 2: Helpers para abrir el sheet en modo crear/editar y guardar**

Reemplazar `onCreate` por funciones de abrir/guardar:

```ts
  function openCreate() {
    setIsEditing(false);
    setFormGoalId(-1); // -1 = creando (no hay id todavía)
    setName('');
    setTargetText('');
    setLinkedAccountId(null);
    setTargetDate(null);
    setError('');
  }

  function openEdit(g: (typeof goals extends (infer U)[] ? U : never)) {
    setIsEditing(true);
    setFormGoalId(g.id);
    setName(g.name);
    setTargetText(String(g.targetAmount));
    setLinkedAccountId(g.accountId ?? null);
    setTargetDate(g.targetDate ?? null);
    setError('');
  }

  function closeForm() {
    setFormGoalId(null);
  }

  function onSubmit() {
    const parsed = goalSchema.safeParse({
      name,
      targetAmount: parseAmount(targetText || '0'),
      accountId: isEditing ? undefined : linkedAccountId,
      targetDate,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      if (isEditing && formGoalId != null && formGoalId > 0) {
        updateGoal(db, formGoalId, { name: parsed.data.name, targetAmount: parsed.data.targetAmount, targetDate: parsed.data.targetDate ?? null });
      } else {
        createGoal(db, parsed.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      return;
    }
    closeForm();
  }
```

Nota: el tipo del parámetro de `openEdit` es engorroso; en la implementación real, definir `type Goal = NonNullable<typeof goals>[number]` justo debajo del `useLiveQuery` de goals y usar `openEdit(g: Goal)`.

- [ ] **Step 3: Preview en vivo (computado en el render del sheet)**

Dentro del componente, antes del `return`, calcular el preview a partir de los valores del formulario:

```ts
  const previewAmount = parseAmount(targetText || '0');
  const previewProgress = isEditing && formGoalId != null && formGoalId > 0
    ? goalProgress((goals ?? []).find((g) => g.id === formGoalId)!, accs ?? [], txs ?? [])
    : 0;
  const preview = targetDate && previewAmount > 0
    ? monthlyTarget(
        { targetAmount: previewAmount, targetDate, manualAmount: previewProgress } as any,
        previewProgress,
        today,
      )
    : null;
```

(El cast `as any` es aceptable aquí porque `monthlyTarget` solo lee `targetAmount` y `targetDate`; alternativamente construir un objeto `SavingsGoal` completo.)

- [ ] **Step 4: Mostrar el ahorro sugerido en cada tarjeta**

Dentro de `renderItem`, después de calcular `progress`/`pct`/`done`, agregar:

```ts
          const mt = monthlyTarget(g, progress, today);
```

Y debajo del bloque de la barra de progreso (después del `View` con `pct` y botones), agregar el renglón:

```tsx
              {mt.status === 'activa' ? (
                <Text className="mt-1.5 text-[10.5px] font-medium text-sub dark:text-sub-dark">
                  Ahorra {formatCOP(mt.perMonth)}/mes · faltan {mt.monthsLeft} {mt.monthsLeft === 1 ? 'mes' : 'meses'} ({monthLabel(monthOf(mt.targetDate))})
                </Text>
              ) : mt.status === 'vencida' ? (
                <Text className="mt-1.5 text-[10.5px] font-medium text-neg dark:text-neg-dark">
                  Plazo vencido · faltan {formatCOP(mt.remaining)}
                </Text>
              ) : null}
```

Hacer la tarjeta tocable para editar: envolver el contenido de la tarjeta en un `Pressable` con `onPress={() => openEdit(g)}` (mantener el `Pressable` de borrar y el botón Abonar con `onPress` propios; RN respeta el handler del hijo). La forma más simple: cambiar el `<View className="rounded-card ...">` externo por `<Pressable className="rounded-card ..." onPress={() => openEdit(g)}>`.

- [ ] **Step 5: Botón "+" abre modo crear**

Cambiar el `AddButton`:

```tsx
        <AddButton onPress={openCreate} />
```

- [ ] **Step 6: Campo de fecha + preview en el sheet**

En el sheet (antes controlado por `createOpen`), cambiar la condición de apertura a `formGoalId != null`, el título dinámico, y agregar el campo de fecha y el preview. Reemplazar el contenido del `ScrollView` del sheet:

```tsx
            <View className="mb-3.5 h-1 w-9 self-center rounded-full bg-line dark:bg-line-dark" />
            <Text className="mb-3.5 text-base font-bold text-ink dark:text-ink-dark">{isEditing ? 'Editar meta' : 'Nueva meta'}</Text>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Viaje a San Andrés" />
            <Field label="Monto objetivo (COP)" value={targetText} onChangeText={setTargetText} keyboardType="numeric" />

            <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Fecha objetivo (opcional)</Text>
            <View className="mb-2 flex-row flex-wrap">
              <Chip label="Sin fecha" selected={targetDate === null} onPress={() => setTargetDate(null)} />
              <Chip
                label={targetDate ? `📅 ${targetDate}` : '📅 Elegir'}
                selected={targetDate !== null}
                onPress={() => setShowDatePicker(true)}
              />
            </View>
            {showDatePicker ? (
              <DateTimePicker
                value={new Date(`${targetDate ?? today}T12:00:00`)}
                mode="date"
                minimumDate={new Date(`${today}T12:00:00`)}
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setTargetDate(todayISO(d));
                }}
              />
            ) : null}

            {!isEditing ? (
              <>
                <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Ligar a una cuenta (opcional)</Text>
                <View className="mb-2 flex-row flex-wrap">
                  <Chip label="Manual" selected={linkedAccountId === null} onPress={() => setLinkedAccountId(null)} />
                  {(accs ?? []).map((a) => (
                    <Chip key={a.id} label={a.name} selected={linkedAccountId === a.id} onPress={() => setLinkedAccountId(a.id)} />
                  ))}
                </View>
              </>
            ) : null}

            {preview && preview.status === 'activa' ? (
              <Text className="mb-2 text-[11px] font-medium text-primary dark:text-primary-dark">
                ≈ {formatCOP(preview.perMonth)}/mes durante {preview.monthsLeft} {preview.monthsLeft === 1 ? 'mes' : 'meses'}
              </Text>
            ) : preview && preview.status === 'vencida' ? (
              <Text className="mb-2 text-[11px] font-medium text-neg dark:text-neg-dark">La fecha elegida ya pasó</Text>
            ) : null}

            {error ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
            <View className="mt-1 flex-row gap-2.5">
              <Button style={{ flex: 1 }} label="Cancelar" variant="ghost" onPress={closeForm} />
              <Button style={{ flex: 1 }} label={isEditing ? 'Guardar' : 'Crear'} onPress={onSubmit} />
            </View>
```

Y cambiar la condición de apertura del sheet de `createOpen ?` a `formGoalId != null ?`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: sin errores. (Resolver el tipo de `openEdit` con `type Goal = NonNullable<typeof goals>[number]` como se indicó en el Step 2.)

- [ ] **Step 8: Verificación manual**

Iniciar la app (`npm run android` o Expo). Verificar:
1. Crear meta manual con fecha objetivo → la tarjeta muestra "Ahorra $X/mes · faltan N meses (mes año)".
2. En el sheet, al elegir monto y fecha, aparece "≈ $X/mes durante N meses" en vivo.
3. Tocar una meta existente → abre el sheet en modo edición precargado; guardar cambia nombre/monto/fecha.
4. Fecha en el pasado (solo posible en metas viejas/edición) → tarjeta muestra "Plazo vencido · faltan $X".
5. Meta sin fecha → no muestra renglón de ahorro (comportamiento actual intacto).
6. Botón Abonar y el ícono de borrar siguen funcionando sin abrir el editor.

- [ ] **Step 9: Commit**

```bash
git add app/\(tabs\)/metas.tsx
git commit -m "feat(metas): ahorro mensual en tarjeta y sheet crear/editar con fecha"
```

---

## Self-Review

**Spec coverage:**
- Campo `targetDate` opcional → Task 1. ✓
- Función `monthlyTarget` con estados → Task 3 (helper `monthsBetween` en Task 2). ✓
- Display en tarjeta (activa/vencida) → Task 5 Step 4. ✓
- Sheet crear/editar con fecha + preview en vivo → Task 5 Steps 6, 3. ✓
- `createGoal`/`updateGoal` con targetDate → Task 4. ✓
- Validación `goalSchema` → Task 4 Step 3. ✓
- Tests de `monthlyTarget` (todos los estados) → Task 3. ✓

**Placeholders:** ninguno pendiente; el nombre del archivo de migración `<generado>` se resuelve en Task 1 Step 2 (instrucción explícita de anotarlo).

**Type consistency:** `monthlyTarget(goal, progress, today)` usado igual en Task 3, 5 Step 3 y 5 Step 4. `updateGoal(db, id, patch)` con firma idéntica en Task 4 y consumido en Task 5. `MonthlyTarget.status` valores (`sin_fecha`/`completa`/`vencida`/`activa`) consistentes entre calc y UI.
