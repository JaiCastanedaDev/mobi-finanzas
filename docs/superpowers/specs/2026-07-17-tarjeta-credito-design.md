# Tarjeta de crédito en Cuentas

**Fecha:** 2026-07-17
**Estado:** Aprobado para plan

## Objetivo

Permitir tener una **tarjeta de crédito** como cuenta, con **cupo fijo**, registrar **gastos con la tarjeta**, y en la fecha de corte u otras fechas **pagarla desde otra cuenta**.

## Enfoque

Modelo **simple** (sin ciclos de facturación reales): la tarjeta guarda cupo, día de corte y día de pago (informativos), muestra **deuda total** y **cupo disponible**, y se paga con una transferencia desde otra cuenta por un monto libre. Reutiliza al máximo el modelo de transacciones existente.

## Decisiones tomadas

- Ciclo de corte: **simple** (cupo + deuda total + fechas de aviso).
- Sobre-cupo: **avisar pero permitir** el gasto.
- Corte/pago: **solo mostrar fechas**, sin notificaciones (v1).
- **Edición de cuentas incluida** (tocar la fila abre el sheet en modo edición).

## Alcance

- Tipo de cuenta `credito` con cupo, día de corte y día de pago.
- Cálculo de deuda y cupo disponible.
- Aviso de sobre-cupo al registrar gastos con la tarjeta.
- Acción "Pagar tarjeta" (transferencia desde otra cuenta).
- Display de tarjeta en Cuentas (deuda / disponible / próximas fechas).
- Edición de cuentas (todas, no solo tarjetas).

Fuera de alcance: saldo por corte / ciclos reales, intereses, pago mínimo, notificaciones de corte/pago, cuotas/diferido.

## Datos (schema — [db/schema.ts](../../../db/schema.ts))

En `accounts`:

```ts
type: text('type', { enum: ['debito', 'ahorro', 'efectivo', 'credito'] }).notNull(),
creditLimit: integer('credit_limit'), // cupo, nullable (solo credito)
cutoffDay: integer('cutoff_day'),     // día de corte 1-31, nullable
dueDay: integer('due_day'),           // día de pago 1-31, nullable
```

- Migración Drizzle (`ADD COLUMN` x3 + cambio de enum es solo TS; SQLite no valida el CHECK del enum, así que basta agregar columnas). Generar con `drizzle-kit`.
- Cuentas existentes quedan con las columnas nuevas en `null`.

### Deuda inicial

Una tarjeta nueva puede tener deuda previa. Se reutiliza `initialBalance`: la "Deuda actual (opcional)" del formulario se guarda como `initialBalance` **negativo** (default 0). No se agrega columna nueva.

## Semántica de saldo (reutiliza `accountBalance`)

`accountBalance` ([lib/calc.ts](../../../lib/calc.ts)) ya cubre la tarjeta:
- Un `gasto` con `accountId = tarjeta` resta (aumenta deuda).
- Un pago es una `transferencia` con `toAccountId = tarjeta`, que suma (reduce deuda).
- El balance de la tarjeta es normalmente ≤ 0 (deuda).

Helpers nuevos:

```ts
function cardDebt(card: Account, txs: Tx[]): number       // max(0, -balance)
function cardAvailable(card: Account, txs: Tx[]): number  // (creditLimit ?? 0) - cardDebt, min 0
```

- `cardDebt = Math.max(0, -accountBalance(card, txs))`.
- `cardAvailable = Math.max(0, (card.creditLimit ?? 0) - cardDebt)`.

## Gastos con la tarjeta

No hay concepto nuevo: es un `gasto` cuyo `accountId` es la tarjeta. La tarjeta ya aparece como cuenta seleccionable en [app/movimiento/nuevo.tsx](../../../app/movimiento/nuevo.tsx).

Añadir en `nuevo.tsx`:
- Cuando la cuenta seleccionada (para un `gasto`) es de tipo `credito` y el monto excede `cardAvailable`, mostrar un **aviso no bloqueante** en `text-neg`: "Excede el cupo disponible ($X)". El guardado **sigue permitido**.

Criterio de causación: las compras cuentan como gasto del mes en `monthSummary` y "Gastos por categoría" (sin cambios). Los pagos son transferencias y no se cuentan como gasto, evitando doble conteo. No requiere cambios en `calc.ts` más allá de los helpers.

## Pagar la tarjeta

Botón **"Pagar"** en la fila de la tarjeta en Cuentas → abre un sheet:
- **Cuenta origen:** chips con cuentas no-crédito activas (excluye tarjetas).
- **Monto:** default = `cardDebt` (deuda total), editable.
- **Fecha:** default hoy, con el mismo `DateTimePicker` de `nuevo.tsx`.

Al confirmar llama a `createTransaction(db, { kind: 'transferencia', accountId: origen, toAccountId: tarjeta, amount, date })`. Reutiliza validación y lógica existentes (origen ≠ destino ya está garantizado).

## UI de Cuentas ([app/(tabs)/cuentas.tsx](../../../app/(tabs)/cuentas.tsx))

### Crear / editar (el sheet pasa a servir para ambos)

- El grupo de chips de tipo gana **"Crédito"** (`TIPOS` + `'credito'`).
- Al elegir `credito` se revelan campos:
  - **Cupo (COP)** — requerido, > 0.
  - **Día de corte** — opcional, entero 1–31.
  - **Día de pago** — opcional, entero 1–31.
- El campo actual "Saldo inicial (COP)" se muestra como **"Deuda actual (opcional)"** cuando el tipo es `credito`, y se persiste como `initialBalance` negativo.
- **Modo edición:** tocar la fila de una cuenta abre el sheet precargado. Guardar llama a `updateAccount` (ya existe en el repo; se amplía para los campos nuevos). El long-press para eliminar se mantiene.

### Fila de tarjeta

En lugar de un único saldo:
- `Deuda $X · Disponible $Y / $Cupo`.
- Barra de progreso de cupo usado (`cardDebt / creditLimit`).
- `Corte: 15 ago · Pago: 5 sep` usando `nextDateForDay` (se omite el que no esté definido).
- Botón **Pagar**.

Las cuentas no-crédito conservan su fila actual.

## Helpers de fecha ([lib/dates.ts](../../../lib/dates.ts))

```ts
function nextDateForDay(day: number, today: string): string // ISO YYYY-MM-DD
```
- Devuelve la próxima ocurrencia de `day` como día del mes: este mes si `day` >= día de hoy, si no el mes siguiente.
- Clamp al último día del mes cuando `day` excede la longitud del mes (ej. día 31 en febrero → 28/29).

## Validación y repos

- [lib/validation.ts](../../../lib/validation.ts): `accountSchema` acepta `type: 'credito'`. Si es `credito`: `creditLimit` requerido entero > 0; `cutoffDay`/`dueDay` opcionales enteros 1–31. Para no-crédito, esos campos deben ir vacíos/nulos.
- [db/repos/accounts.ts](../../../db/repos/accounts.ts): `createAccount` y `updateAccount` aceptan y persisten `type='credito'`, `creditLimit`, `cutoffDay`, `dueDay`. `updateAccount` ya existe; se amplía el tipo `AccountInput`.

## Tests (Vitest, [tests/](../../../tests/))

- `cardDebt` / `cardAvailable`: tarjeta con compras y pagos → deuda y disponible correctos; disponible nunca negativo.
- Deuda inicial: `initialBalance` negativo se refleja en `cardDebt`.
- Sobre-cupo: detección de monto > disponible.
- `nextDateForDay`: día ya pasado este mes → mes siguiente; día 31 en mes corto → clamp; día = hoy → hoy.
- Pagar: una transferencia origen → tarjeta reduce `cardDebt` en el monto pagado.
- `updateAccount` con campos de crédito persiste correctamente; `createAccount` de crédito sin cupo válido lanza.

## Riesgos / notas

- La migración corre vía `useMigrations` en [app/_layout.tsx](../../../app/_layout.tsx); confirmar que el archivo generado quede incluido en `drizzle/migrations`.
- `removeAccount` ya archiva cuentas con movimientos; una tarjeta con gastos/pagos se archivará igual (sin cambios).
- El aviso de sobre-cupo es informativo; no altera el guardado ni la validación del schema de transacciones.
- Pagos que superen la deuda (sobrepago) dejan la tarjeta con balance positivo; `cardDebt` = 0 y `cardAvailable` se limita al cupo. Es un caso benigno y esperado.
