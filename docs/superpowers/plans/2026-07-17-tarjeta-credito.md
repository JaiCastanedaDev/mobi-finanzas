# Tarjeta de Crédito en Cuentas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir una cuenta tipo tarjeta de crédito con cupo fijo, registrar gastos con ella (con aviso de sobre-cupo), ver deuda/cupo disponible y próximas fechas de corte/pago, y pagarla con una transferencia desde otra cuenta.

**Architecture:** Se añade el tipo `credito` y columnas `credit_limit`, `cutoff_day`, `due_day` a `accounts`. `accountBalance` (existente) ya modela la deuda: gastos restan, pagos (transferencias entrantes) suman; dos helpers derivan deuda y disponible. Pagar es una `transferencia` origen→tarjeta creada con `createTransaction`. La UI de Cuentas gana modo edición, campos de crédito y una acción "Pagar".

**Tech Stack:** Expo 57, expo-router, Drizzle ORM + expo-sqlite, NativeWind, Zod, Vitest, `@react-native-community/datetimepicker`.

## Global Constraints

- Dinero en enteros COP. Montos validados como `int` positivo.
- Fechas ISO `YYYY-MM-DD` (string). Helpers de fecha reciben `today` como parámetro y no llaman `new Date()` para su lógica (son puros/testeables).
- El balance de una tarjeta es normalmente ≤ 0 (deuda). `cardDebt = max(0, -balance)`, `cardAvailable = max(0, cupo - deuda)`.
- Sobre-cupo: **avisar pero permitir** (nunca bloquear el guardado).
- Sin ciclos de corte reales, intereses, pago mínimo ni notificaciones (fuera de alcance).
- Tests: `npm test`. Typecheck: `npm run typecheck`. Migraciones: `npx drizzle-kit generate` + registrar en `drizzle/migrations.js`.

---

### Task 1: Schema + migración para tarjeta de crédito

**Files:**
- Modify: `db/schema.ts:3-10` (tabla `accounts`)
- Create: `drizzle/000X_<generado>.sql`
- Modify: `drizzle/migrations.js`

**Interfaces:**
- Produces: `Account` (inferido) gana `type` con `'credito'` y `creditLimit: number | null`, `cutoffDay: number | null`, `dueDay: number | null`.

- [ ] **Step 1: Actualizar el schema**

En `db/schema.ts`, reemplazar la tabla `accounts`:

```ts
export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['debito', 'ahorro', 'efectivo', 'credito'] }).notNull(),
  initialBalance: integer('initial_balance').notNull().default(0),
  creditLimit: integer('credit_limit'),
  cutoffDay: integer('cutoff_day'),
  dueDay: integer('due_day'),
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull(),
});
```

- [ ] **Step 2: Generar la migración**

Run: `npx drizzle-kit generate`
Expected: crea `drizzle/000X_*.sql` con tres `ALTER TABLE accounts ADD COLUMN ...` (`credit_limit`, `cutoff_day`, `due_day`). El enum `type` es solo TS (SQLite no valida CHECK), así que no genera cambio de columna para `type`. Anota el nombre exacto (`000X`) del archivo.

- [ ] **Step 3: Registrar la migración en migrations.js**

En `drizzle/migrations.js`, agregar el import y la entrada (usa el índice/nombre real del Step 2; si es la 2ª migración del repo será `m0001`, si Metas ya añadió la 0001 será `m0002`):

```js
import mXXXX from './000X_<generado>.sql';
// ...
    migrations: {
      m0000,
      // ...migraciones previas...
      mXXXX
    }
```

- [ ] **Step 4: Verificar la suite**

Run: `npm test`
Expected: PASS (las migraciones aplican las columnas nuevas en la BD de test).

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add db/schema.ts drizzle/
git commit -m "feat(cuentas): tipo credito y columnas credit_limit/cutoff_day/due_day"
```

---

### Task 2: Helpers `cardDebt` y `cardAvailable` en calc.ts

**Files:**
- Modify: `lib/calc.ts`
- Test: `tests/calc.test.ts`

**Interfaces:**
- Consumes: `accountBalance` (existente), tipos `Account`, `Tx`.
- Produces:
  - `cardDebt(card: Account, txs: Tx[]): number`
  - `cardAvailable(card: Account, txs: Tx[]): number`

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/calc.test.ts`. El helper `acc` existente crea cuentas `debito`; para tarjetas define uno local:

```ts
import { cardAvailable, cardDebt } from '../lib/calc';

describe('cardDebt / cardAvailable', () => {
  const card = (creditLimit: number, initialBalance = 0): Account =>
    ({ id: 9, name: 'Visa', type: 'credito', initialBalance, creditLimit, cutoffDay: null, dueDay: null, archivedAt: null, createdAt: '' }) as Account;

  it('deuda = suma de gastos con la tarjeta; disponible = cupo - deuda', () => {
    const c = card(1000000);
    const txs = [
      tx({ kind: 'gasto', amount: 300000, accountId: 9 }),
      tx({ kind: 'gasto', amount: 200000, accountId: 9 }),
    ];
    expect(cardDebt(c, txs)).toBe(500000);
    expect(cardAvailable(c, txs)).toBe(500000);
  });

  it('un pago (transferencia entrante) reduce la deuda', () => {
    const c = card(1000000);
    const txs = [
      tx({ kind: 'gasto', amount: 500000, accountId: 9 }),
      tx({ kind: 'transferencia', amount: 200000, accountId: 1, toAccountId: 9 }),
    ];
    expect(cardDebt(c, txs)).toBe(300000);
    expect(cardAvailable(c, txs)).toBe(700000);
  });

  it('deuda inicial vía initialBalance negativo', () => {
    const c = card(1000000, -400000);
    expect(cardDebt(c, [])).toBe(400000);
    expect(cardAvailable(c, [])).toBe(600000);
  });

  it('sobrepago → deuda 0 y disponible limitado al cupo', () => {
    const c = card(1000000);
    const txs = [
      tx({ kind: 'gasto', amount: 100000, accountId: 9 }),
      tx({ kind: 'transferencia', amount: 300000, accountId: 1, toAccountId: 9 }),
    ];
    expect(cardDebt(c, txs)).toBe(0);
    expect(cardAvailable(c, txs)).toBe(1000000);
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npm test -- calc`
Expected: FAIL con "cardDebt is not a function".

- [ ] **Step 3: Implementar los helpers**

Al final de `lib/calc.ts`:

```ts
export function cardDebt(card: Account, txs: Tx[]): number {
  return Math.max(0, -accountBalance(card, txs));
}

export function cardAvailable(card: Account, txs: Tx[]): number {
  return Math.max(0, (card.creditLimit ?? 0) - cardDebt(card, txs));
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm test -- calc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/calc.ts tests/calc.test.ts
git commit -m "feat(cuentas): helpers cardDebt y cardAvailable"
```

---

### Task 3: Helper `nextDateForDay` en dates.ts

**Files:**
- Modify: `lib/dates.ts`
- Test: `tests/dates.test.ts`

**Interfaces:**
- Produces: `nextDateForDay(day: number, today: string): string` — próxima ocurrencia (ISO) de ese día del mes, con clamp al último día del mes.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `tests/dates.test.ts`:

```ts
import { nextDateForDay } from '../lib/dates';

describe('nextDateForDay', () => {
  it('día futuro dentro del mes actual', () => {
    expect(nextDateForDay(20, '2026-07-17')).toBe('2026-07-20');
  });
  it('día = hoy → hoy', () => {
    expect(nextDateForDay(17, '2026-07-17')).toBe('2026-07-17');
  });
  it('día ya pasado → mes siguiente', () => {
    expect(nextDateForDay(5, '2026-07-17')).toBe('2026-08-05');
  });
  it('clamp al último día en meses cortos', () => {
    expect(nextDateForDay(31, '2026-02-10')).toBe('2026-02-28');
  });
  it('cruce de año en diciembre', () => {
    expect(nextDateForDay(5, '2026-12-10')).toBe('2027-01-05');
  });
});
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npm test -- dates`
Expected: FAIL con "nextDateForDay is not a function".

- [ ] **Step 3: Implementar el helper**

Al final de `lib/dates.ts`:

```ts
export function nextDateForDay(day: number, today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const daysIn = (yy: number, mm: number) => new Date(yy, mm, 0).getDate(); // mm 1-based
  const iso = (yy: number, mm: number, dd: number) =>
    `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const thisClamped = Math.min(day, daysIn(y, m));
  if (thisClamped >= d) return iso(y, m, thisClamped);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return iso(ny, nm, Math.min(day, daysIn(ny, nm)));
}
```

- [ ] **Step 4: Correr los tests**

Run: `npm test -- dates`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/dates.ts tests/dates.test.ts
git commit -m "feat(dates): helper nextDateForDay"
```

---

### Task 4: Validación y repo de cuentas para crédito

**Files:**
- Modify: `lib/validation.ts:26-30` (`accountSchema`)
- Modify: `db/repos/accounts.ts:5` (tipo `AccountInput`), `:19-34` (`createAccount`/`updateAccount`)
- Test: `tests/validation.test.ts`, `tests/accounts.test.ts`

**Interfaces:**
- Consumes: schema `accounts` con columnas de crédito (Task 1).
- Produces:
  - `AccountInput` incluye `type: 'debito' | 'ahorro' | 'efectivo' | 'credito'` y opcionales `creditLimit`, `cutoffDay`, `dueDay` (`number | null`).
  - `createAccount`/`updateAccount` persisten esos campos.
  - `accountSchema` exige `creditLimit > 0` cuando `type === 'credito'`.

- [ ] **Step 1: Escribir los tests que fallan (validación)**

Agregar a `tests/validation.test.ts`, dentro del `describe('accountSchema / goalSchema')` o en uno nuevo:

```ts
describe('accountSchema — crédito', () => {
  it('crédito exige cupo > 0', () => {
    expect(accountSchema.safeParse({ name: 'Visa', type: 'credito', initialBalance: 0 }).success).toBe(false);
    expect(accountSchema.safeParse({ name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 0 }).success).toBe(false);
    expect(accountSchema.safeParse({ name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 2000000, cutoffDay: 15, dueDay: 5 }).success).toBe(true);
  });
  it('días de corte/pago fuera de 1-31 se rechazan', () => {
    expect(accountSchema.safeParse({ name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 1000, cutoffDay: 32 }).success).toBe(false);
    expect(accountSchema.safeParse({ name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 1000, dueDay: 0 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Escribir los tests que fallan (repo)**

Agregar a `tests/accounts.test.ts`:

```ts
it('crea tarjeta de crédito con cupo y fechas', () => {
  const db = createTestDb();
  const id = createAccount(db, { name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 3000000, cutoffDay: 15, dueDay: 5 });
  const row = db.select().from(accounts).all()[0];
  expect(row.type).toBe('credito');
  expect(row.creditLimit).toBe(3000000);
  expect(row.cutoffDay).toBe(15);
  expect(row.dueDay).toBe(5);
  expect(id).toBeGreaterThan(0);
});

it('updateAccount edita cupo y fechas de la tarjeta', () => {
  const db = createTestDb();
  const id = createAccount(db, { name: 'Visa', type: 'credito', initialBalance: 0, creditLimit: 3000000, cutoffDay: 15, dueDay: 5 });
  updateAccount(db, id, { creditLimit: 4000000, cutoffDay: 20 });
  const row = db.select().from(accounts).all()[0];
  expect(row.creditLimit).toBe(4000000);
  expect(row.cutoffDay).toBe(20);
  expect(row.dueDay).toBe(5);
});
```

- [ ] **Step 3: Correr para verlos fallar**

Run: `npm test -- validation accounts`
Expected: FAIL (schema rechaza `type: 'credito'`; createAccount no persiste los campos nuevos).

- [ ] **Step 4: Actualizar `accountSchema`**

En `lib/validation.ts`, reemplazar `accountSchema`:

```ts
export const accountSchema = z
  .object({
    name: z.string().trim().min(1, 'Escribe un nombre'),
    type: z.enum(['debito', 'ahorro', 'efectivo', 'credito']),
    initialBalance: z.number({ message: 'Escribe el saldo inicial' }).int(),
    creditLimit: z.number().int().positive('El cupo debe ser mayor que 0').nullable().optional(),
    cutoffDay: z.number().int().min(1, 'Día inválido').max(31, 'Día inválido').nullable().optional(),
    dueDay: z.number().int().min(1, 'Día inválido').max(31, 'Día inválido').nullable().optional(),
  })
  .refine((v) => v.type !== 'credito' || (v.creditLimit != null && v.creditLimit > 0), {
    message: 'El cupo debe ser mayor que 0',
    path: ['creditLimit'],
  });
```

- [ ] **Step 5: Actualizar `AccountInput`, `createAccount` y `updateAccount`**

En `db/repos/accounts.ts`, reemplazar el tipo y las dos funciones (mantener `assertNameFree` y `removeAccount` igual):

```ts
type AccountInput = {
  name: string;
  type: 'debito' | 'ahorro' | 'efectivo' | 'credito';
  initialBalance: number;
  creditLimit?: number | null;
  cutoffDay?: number | null;
  dueDay?: number | null;
};

export function createAccount(db: DB, input: AccountInput): number {
  assertNameFree(db, input.name);
  const res = db
    .insert(accounts)
    .values({
      name: input.name.trim(),
      type: input.type,
      initialBalance: input.initialBalance,
      creditLimit: input.creditLimit ?? null,
      cutoffDay: input.cutoffDay ?? null,
      dueDay: input.dueDay ?? null,
      createdAt: new Date().toISOString(),
    })
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
```

- [ ] **Step 6: Correr los tests**

Run: `npm test -- validation accounts`
Expected: PASS.

- [ ] **Step 7: Typecheck y commit**

Run: `npm run typecheck` → sin errores.

```bash
git add lib/validation.ts db/repos/accounts.ts tests/validation.test.ts tests/accounts.test.ts
git commit -m "feat(cuentas): validacion y repo para tarjeta de credito"
```

---

### Task 5: UI de Cuentas — crédito, edición y pagar

**Files:**
- Modify: `app/(tabs)/cuentas.tsx`

**Interfaces:**
- Consumes: `cardDebt`/`cardAvailable` (Task 2), `nextDateForDay` (Task 3), `createAccount`/`updateAccount`/`removeAccount` (Task 4), `createTransaction` (existente), `accountSchema` (Task 4), `dayLabel`/`todayISO` (existentes), `formatCOP`/`parseAmount` (existentes), `DateTimePicker`.

Task de UI: verificación por typecheck + manual.

- [ ] **Step 1: Imports y tipo Account**

En `app/(tabs)/cuentas.tsx`, añadir imports:

```ts
import DateTimePicker from '@react-native-community/datetimepicker';
import { accountBalance, cardAvailable, cardDebt } from '../../lib/calc';
import { createAccount, removeAccount, updateAccount } from '../../db/repos/accounts';
import { createTransaction } from '../../db/repos/transactions';
import { dayLabel, todayISO } from '../../lib/dates';
```

(Reemplaza el import previo de `accountBalance` y el de `createAccount, removeAccount`.)

Agregar `'credito'` a `TIPOS`:

```ts
const TIPOS = [
  { value: 'debito', label: 'Débito' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'credito', label: 'Crédito' },
] as const;
```

Debajo del `useLiveQuery` de `accs`, definir el tipo local:

```ts
type Account = NonNullable<typeof accs>[number];
```

- [ ] **Step 2: Estado del formulario (crear/editar) y del pago**

Reemplazar el bloque de estado del modal por:

```ts
  const today = todayISO();
  const [editingId, setEditingId] = useState<number | null>(null); // null cuando el sheet está cerrado
  const [name, setName] = useState('');
  const [type, setType] = useState<'debito' | 'ahorro' | 'efectivo' | 'credito'>('debito');
  const [balanceText, setBalanceText] = useState('');
  const [cupoText, setCupoText] = useState('');
  const [cutoffText, setCutoffText] = useState('');
  const [dueText, setDueText] = useState('');
  const [error, setError] = useState('');

  // Pago de tarjeta
  const [payCard, setPayCard] = useState<Account | null>(null);
  const [payAccountId, setPayAccountId] = useState<number | null>(null);
  const [payAmountText, setPayAmountText] = useState('');
  const [payDate, setPayDate] = useState(today);
  const [showPayPicker, setShowPayPicker] = useState(false);
  const [payError, setPayError] = useState('');
```

`editingId === -1` significa "creando"; `> 0` significa editar esa cuenta.

- [ ] **Step 3: Abrir/guardar cuenta**

Reemplazar `onCreate` por:

```ts
  function openCreate() {
    setEditingId(-1);
    setName('');
    setType('debito');
    setBalanceText('');
    setCupoText('');
    setCutoffText('');
    setDueText('');
    setError('');
  }

  function openEdit(a: Account) {
    setEditingId(a.id);
    setName(a.name);
    setType(a.type);
    setBalanceText(a.type === 'credito' && a.initialBalance < 0 ? String(-a.initialBalance) : String(a.initialBalance));
    setCupoText(a.creditLimit != null ? String(a.creditLimit) : '');
    setCutoffText(a.cutoffDay != null ? String(a.cutoffDay) : '');
    setDueText(a.dueDay != null ? String(a.dueDay) : '');
    setError('');
  }

  function onSubmit() {
    const isCredito = type === 'credito';
    // Para crédito, "Deuda actual" se guarda como initialBalance negativo.
    const initialBalance = isCredito ? -parseAmount(balanceText || '0') : parseAmount(balanceText || '0');
    const parsed = accountSchema.safeParse({
      name,
      type,
      initialBalance,
      creditLimit: isCredito ? parseAmount(cupoText || '0') : null,
      cutoffDay: isCredito && cutoffText ? Number(cutoffText) : null,
      dueDay: isCredito && dueText ? Number(dueText) : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      if (editingId != null && editingId > 0) updateAccount(db, editingId, parsed.data);
      else createAccount(db, parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      return;
    }
    setEditingId(null);
  }
```

- [ ] **Step 4: Abrir/confirmar pago**

Agregar:

```ts
  function openPay(card: Account) {
    setPayCard(card);
    setPayAmountText(String(cardDebt(card, txs ?? [])));
    setPayAccountId(null);
    setPayDate(today);
    setPayError('');
  }

  function onPay() {
    if (payAccountId == null) {
      setPayError('Elige la cuenta de origen');
      return;
    }
    try {
      createTransaction(db, {
        kind: 'transferencia',
        amount: parseAmount(payAmountText || '0'),
        date: payDate,
        accountId: payAccountId,
        toAccountId: payCard!.id,
      });
      setPayCard(null);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : 'Error');
    }
  }
```

- [ ] **Step 5: Fila de cuenta — tarjeta vs. normal**

Reemplazar el `renderItem` del `FlatList` para ramificar por tipo. Las cuentas no-crédito conservan su fila (ahora tocable para editar):

```tsx
        renderItem={({ item: a }) => {
          if (a.type === 'credito') {
            const debt = cardDebt(a, txs ?? []);
            const avail = cardAvailable(a, txs ?? []);
            const cupo = a.creditLimit ?? 0;
            const pctUsed = cupo > 0 ? Math.min(100, Math.round((debt / cupo) * 100)) : 0;
            return (
              <Pressable
                onPress={() => openEdit(a)}
                onLongPress={() => onRemove(a.id, a.name)}
                className="rounded-row border border-line bg-card px-[15px] py-3.5 dark:border-line-dark dark:bg-card-dark"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-[13.5px] font-semibold text-ink dark:text-ink-dark">{a.name}</Text>
                  <Text className="text-[10.5px] font-medium text-sub dark:text-sub-dark">Crédito</Text>
                </View>
                <View className="mt-1 flex-row items-center justify-between">
                  <Text className="text-[11px] font-medium text-sub dark:text-sub-dark">Deuda</Text>
                  <Text className="text-[15px] font-bold" style={{ color: debt > 0 ? t.neg : t.text }}>{formatCOP(debt)}</Text>
                </View>
                <View className="mt-2 h-2 overflow-hidden rounded-full bg-line dark:bg-line-dark">
                  <View className="h-full rounded-full" style={{ width: `${pctUsed}%`, backgroundColor: t.neg }} />
                </View>
                <Text className="mt-1.5 text-[10.5px] font-medium text-sub dark:text-sub-dark">
                  Disponible {formatCOP(avail)} / {formatCOP(cupo)}
                  {a.cutoffDay != null ? ` · Corte: ${dayLabel(nextDateForDay(a.cutoffDay, today), today)}` : ''}
                  {a.dueDay != null ? ` · Pago: ${dayLabel(nextDateForDay(a.dueDay, today), today)}` : ''}
                </Text>
                <View className="mt-2.5 flex-row items-center justify-end gap-2.5">
                  <Pressable onPress={() => onRemove(a.id, a.name)} hitSlop={8}>
                    <Trash2 size={15} color={t.textSub} />
                  </Pressable>
                  <Pressable onPress={() => openPay(a)} className="rounded-full bg-primary px-3.5 py-[7px] dark:bg-primary-dark">
                    <Text className="text-[11.5px] font-semibold text-onprimary dark:text-onprimary-dark">Pagar</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }
          const bal = accountBalance(a, txs ?? []);
          return (
            <Pressable
              onPress={() => openEdit(a)}
              onLongPress={() => onRemove(a.id, a.name)}
              className="flex-row items-center rounded-row border border-line bg-card px-[15px] py-3.5 dark:border-line-dark dark:bg-card-dark"
            >
              <View className="min-w-0 flex-1">
                <Text className="text-[13.5px] font-semibold text-ink dark:text-ink-dark">{a.name}</Text>
                <Text className="mt-0.5 text-[10.5px] font-medium capitalize text-sub dark:text-sub-dark">{a.type}</Text>
              </View>
              <Text className="text-[15px] font-bold" style={{ color: bal < 0 ? t.neg : t.text }}>
                {formatCOP(bal)}
              </Text>
              <Pressable onPress={() => onRemove(a.id, a.name)} hitSlop={8} className="ml-3.5">
                <Trash2 size={15} color={t.textSub} />
              </Pressable>
            </Pressable>
          );
        }}
```

(Recordar importar `nextDateForDay` en el Step 1: añadirlo a la línea `import { dayLabel, todayISO } from '../../lib/dates';` → `import { dayLabel, nextDateForDay, todayISO } from '../../lib/dates';`.)

- [ ] **Step 6: Sheet crear/editar con campos de crédito**

Cambiar `<AddButton onPress={() => setModalOpen(true)} />` por `<AddButton onPress={openCreate} />`.

Cambiar la condición del sheet de `modalOpen ?` a `editingId != null ?`. Reemplazar el contenido del `ScrollView` del sheet:

```tsx
            <View className="mb-3.5 h-1 w-9 self-center rounded-full bg-line dark:bg-line-dark" />
            <Text className="mb-3.5 text-base font-bold text-ink dark:text-ink-dark">{editingId != null && editingId > 0 ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Nequi" />
            <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Tipo</Text>
            <View className="mb-2 flex-row flex-wrap">
              {TIPOS.map((tp) => (
                <Chip key={tp.value} label={tp.label} selected={type === tp.value} onPress={() => setType(tp.value)} />
              ))}
            </View>
            {type === 'credito' ? (
              <>
                <Field label="Cupo (COP)" value={cupoText} onChangeText={setCupoText} keyboardType="numeric" placeholder="0" />
                <View className="flex-row gap-2.5">
                  <View className="flex-1">
                    <Field label="Día de corte" value={cutoffText} onChangeText={setCutoffText} keyboardType="numeric" placeholder="15" />
                  </View>
                  <View className="flex-1">
                    <Field label="Día de pago" value={dueText} onChangeText={setDueText} keyboardType="numeric" placeholder="5" />
                  </View>
                </View>
                <Field label="Deuda actual (opcional)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />
              </>
            ) : (
              <Field label="Saldo inicial (COP)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />
            )}
            {error ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
            <View className="mt-1 flex-row gap-2.5">
              <Button style={{ flex: 1 }} label="Cancelar" variant="ghost" onPress={() => setEditingId(null)} />
              <Button style={{ flex: 1 }} label={editingId != null && editingId > 0 ? 'Guardar' : 'Crear'} onPress={onSubmit} />
            </View>
```

- [ ] **Step 7: Sheet de pago**

Agregar, después del sheet de crear/editar (antes de cerrar el `View` raíz):

```tsx
      {payCard != null ? (
        <KeyboardAvoidingView className="absolute inset-0 justify-end bg-black/45" behavior="padding">
          <ScrollView
            className="max-h-full rounded-t-sheet bg-bg dark:bg-bg-dark"
            contentContainerClassName="px-4 pb-6 pt-[18px]"
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-3.5 h-1 w-9 self-center rounded-full bg-line dark:bg-line-dark" />
            <Text className="mb-1 text-base font-bold text-ink dark:text-ink-dark">Pagar {payCard.name}</Text>
            <Text className="mb-3.5 text-[11px] font-medium text-sub dark:text-sub-dark">Deuda actual: {formatCOP(cardDebt(payCard, txs ?? []))}</Text>
            <Field label="Monto (COP)" value={payAmountText} onChangeText={setPayAmountText} keyboardType="numeric" />
            <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Pagar desde</Text>
            <View className="mb-2 flex-row flex-wrap">
              {(accs ?? []).filter((a) => a.type !== 'credito').map((a) => (
                <Chip key={a.id} label={a.name} selected={payAccountId === a.id} onPress={() => setPayAccountId(a.id)} />
              ))}
            </View>
            <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Fecha</Text>
            <View className="mb-2 flex-row">
              <Chip label="Hoy" selected={payDate === today} onPress={() => setPayDate(today)} />
              <Chip label={`📅 ${payDate}`} selected={payDate !== today} onPress={() => setShowPayPicker(true)} />
            </View>
            {showPayPicker ? (
              <DateTimePicker
                value={new Date(`${payDate}T12:00:00`)}
                mode="date"
                maximumDate={new Date()}
                onChange={(_, d) => {
                  setShowPayPicker(false);
                  if (d) setPayDate(todayISO(d));
                }}
              />
            ) : null}
            {payError ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{payError}</Text> : null}
            <View className="mt-1 flex-row gap-2.5">
              <Button style={{ flex: 1 }} label="Cancelar" variant="ghost" onPress={() => setPayCard(null)} />
              <Button style={{ flex: 1 }} label="Pagar" onPress={onPay} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}
```

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 9: Verificación manual**

Iniciar la app. Verificar:
1. Crear cuenta tipo Crédito: aparecen Cupo, Día de corte, Día de pago, Deuda actual. Se crea con cupo > 0 (sin cupo → error "El cupo debe ser mayor que 0").
2. La fila de la tarjeta muestra Deuda, barra de cupo usado, "Disponible $Y / $Cupo", y "Corte: … · Pago: …".
3. Registrar un gasto con la tarjeta (pantalla Nuevo movimiento) → la deuda de la tarjeta sube y el disponible baja.
4. Tocar "Pagar" → elegir cuenta origen y monto (default = deuda), confirmar → la deuda baja y el saldo de la cuenta origen baja.
5. Tocar la fila de una tarjeta o de una cuenta normal → abre el sheet en modo edición; cambiar cupo/fechas/nombre y guardar.
6. Deuda actual al crear: poner "500000" → la tarjeta arranca con deuda $500.000.

- [ ] **Step 10: Commit**

```bash
git add app/\(tabs\)/cuentas.tsx
git commit -m "feat(cuentas): tarjeta de credito con cupo, edicion y pagar"
```

---

### Task 6: Aviso de sobre-cupo al gastar con la tarjeta

**Files:**
- Modify: `app/movimiento/nuevo.tsx`

**Interfaces:**
- Consumes: `cardAvailable` (Task 2), `transactions` schema (para `useLiveQuery`), estado existente `accountId`, `amountDigits`, `kind`.

Task de UI: verificación por typecheck + manual.

- [ ] **Step 1: Cargar transacciones y calcular el aviso**

En `app/movimiento/nuevo.tsx`, importar `cardAvailable` y `transactions`, y añadir un `useLiveQuery` de transacciones:

```ts
import { accounts, transactions } from '../../db/schema';
import { cardAvailable } from '../../lib/calc';
```

Dentro del componente, junto al `useLiveQuery` de `accs`:

```ts
  const { data: txs } = useLiveQuery(db.select().from(transactions));
```

Después de los `useState`, calcular el aviso:

```ts
  const selectedAccount = (accs ?? []).find((a) => a.id === accountId);
  const overLimit =
    kind === 'gasto' && selectedAccount?.type === 'credito'
      ? parseAmount(amountDigits || '0') > cardAvailable(selectedAccount, txs ?? [])
      : false;
  const availableForCard =
    selectedAccount?.type === 'credito' ? cardAvailable(selectedAccount, txs ?? []) : 0;
```

- [ ] **Step 2: Mostrar el aviso (no bloqueante)**

Debajo del bloque de selección de cuenta (después del `View` con los chips de cuenta, antes del bloque de transferencia/categoría), agregar:

```tsx
      {overLimit ? (
        <Text className="mb-2 text-[11px] font-medium text-neg dark:text-neg-dark">
          Excede el cupo disponible ({formatCOP(availableForCard)}). Puedes registrarlo igual.
        </Text>
      ) : null}
```

Importar `formatCOP` si no está: revisar la línea de import de `../../lib/money` y agregar `formatCOP` junto a `parseAmount`:

```ts
import { formatCOP, parseAmount } from '../../lib/money';
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 4: Verificación manual**

Iniciar la app. Con una tarjeta de crédito de cupo pequeño (ej. $100.000 con poco disponible), en Nuevo movimiento tipo Gasto, elegir la tarjeta y escribir un monto mayor al disponible → aparece el aviso rojo "Excede el cupo disponible (…)". El botón Guardar sigue funcionando y registra el gasto.

- [ ] **Step 5: Commit**

```bash
git add app/movimiento/nuevo.tsx
git commit -m "feat(movimiento): aviso de sobre-cupo al gastar con tarjeta"
```

---

## Self-Review

**Spec coverage:**
- Tipo `credito` + columnas cupo/corte/pago → Task 1. ✓
- `cardDebt`/`cardAvailable` reutilizando `accountBalance` → Task 2. ✓
- Gastos con la tarjeta = gasto normal con `accountId` + aviso de sobre-cupo → Task 6. ✓
- Pagar = transferencia origen→tarjeta con `createTransaction` → Task 5 Steps 4, 7. ✓
- Deuda inicial vía `initialBalance` negativo → Task 5 Steps 3, 6; test en Task 2. ✓
- Display de tarjeta (deuda/disponible/fechas/barra) → Task 5 Step 5. ✓
- Edición de cuentas (todas) → Task 5 Steps 3, 5, 6. ✓
- `nextDateForDay` con clamp → Task 3. ✓
- Validación crédito (cupo > 0, días 1–31) → Task 4. ✓
- Tests: cardDebt/available, sobrepago, deuda inicial, nextDateForDay, pago reduce deuda (cubierto por el test de "pago" en Task 2 Step 1 y verificación manual Task 5), updateAccount crédito → Tasks 2, 3, 4. ✓

**Placeholders:** el nombre/índice del archivo de migración (`000X`/`mXXXX`) se resuelve explícitamente en Task 1 Steps 2–3 según el orden real de migraciones del repo.

**Type consistency:** `cardDebt(card, txs)` y `cardAvailable(card, txs)` con la misma firma en Tasks 2, 5, 6. `AccountInput` con los mismos campos opcionales en Task 4 y usado por `accountSchema.data` en Task 5. `type` incluye `'credito'` de forma consistente en schema, validación, repo y UI. `nextDateForDay(day, today)` idéntico en Task 3 y Task 5.

**Nota de orden entre planes:** Metas y Tarjeta agregan cada uno una migración. Ejecutar los planes en orden (primero Metas, luego Tarjeta) hace que Tarjeta sea `0002`; si se ejecuta Tarjeta primero, será `0001`. El Step 3 de Task 1 lo contempla ("índice real").
