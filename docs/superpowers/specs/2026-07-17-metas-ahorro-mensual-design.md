# Metas: cálculo de ahorro mensual

**Fecha:** 2026-07-17
**Estado:** Aprobado para plan

## Objetivo

Que una meta de ahorro pueda tener una **fecha objetivo opcional** y que la app calcule y muestre **cuánto ahorrar por mes** para cumplirla a tiempo, tanto en la tarjeta de la meta como en un preview en vivo al crear o editar.

## Alcance

- Campo `targetDate` opcional en las metas.
- Función pura de cálculo del ahorro mensual sugerido.
- Mostrar el sugerido en la tarjeta de cada meta con fecha.
- Formulario de crear/editar con selector de fecha y preview en vivo.
- Edición de metas existentes (nombre, monto, fecha) tocando la tarjeta.

Fuera de alcance: recordatorios/notificaciones del abono mensual, historial de aportes, proyecciones por interés.

## Datos (schema)

Agregar a `savings_goals` en [db/schema.ts](../../../db/schema.ts):

```ts
targetDate: text('target_date'), // ISO YYYY-MM-DD, nullable
```

- Nullable: las metas existentes quedan con `null` y siguen funcionando como hoy.
- Requiere una migración Drizzle: `ALTER TABLE savings_goals ADD COLUMN target_date text;` (generar con `drizzle-kit`).

## Cálculo (nueva función en [lib/calc.ts](../../../lib/calc.ts))

```ts
type MonthlyTarget =
  | { status: 'sin_fecha' }
  | { status: 'completa' }
  | { status: 'vencida'; remaining: number }
  | { status: 'activa'; perMonth: number; monthsLeft: number; targetDate: string };

function monthlyTarget(goal: SavingsGoal, progress: number, today: string): MonthlyTarget
```

Reglas:

- `progress` viene del `goalProgress(goal, accounts, txs)` que ya existe.
- `remaining = goal.targetAmount − progress`.
- Si `progress >= targetAmount` → `completa`.
- Si `goal.targetDate == null` → `sin_fecha`.
- `monthsLeft = (añoMes(targetDate) − añoMes(today)) + 1`, contando el mes actual como una contribución.
  - Se compara solo año-mes (`YYYY-MM`), no el día.
  - Ejemplo: hoy `2026-07`, meta `2026-12` → `(5) + 1 = 6` meses (jul…dic).
  - Ejemplo: hoy `2026-07`, meta `2026-07` → `0 + 1 = 1` mes (ahorra todo lo que falta este mes).
- Si `monthsLeft <= 0` (el mes objetivo ya pasó) → `vencida` con `remaining`.
- `perMonth = Math.ceil(remaining / monthsLeft)` — **valor exacto** (entero COP), sin redondeo cosmético. `ceil` garantiza que N cuotas cubran o superen ligeramente la meta.

La función es pura y determinista (recibe `today` como parámetro) para poder testearla de forma aislada.

## UI — tarjeta de meta ([app/(tabs)/metas.tsx](../../../app/(tabs)/metas.tsx))

Debajo de la barra de progreso, según el estado de `monthlyTarget`:

- `activa`: renglón en `text-sub` →
  `Ahorra $120.000/mes · faltan 6 meses (dic 2026)`.
- `vencida`: renglón en color de alerta (`text-neg`) →
  `Plazo vencido · faltan $X`.
- `completa` / `sin_fecha`: no se muestra nada nuevo (comportamiento actual).

La etiqueta del mes (`dic 2026`) se formatea desde `targetDate` con un helper corto en [lib/dates.ts](../../../lib/dates.ts) (mes abreviado en español + año).

## UI — crear / editar meta

El sheet actual "Nueva meta" pasa a servir también para editar. Cambios:

- Nuevo campo **"Fecha objetivo (opcional)"** usando `@react-native-community/datetimepicker` con chips, igual al patrón de [app/movimiento/nuevo.tsx](../../../app/movimiento/nuevo.tsx):
  - Chips: `Sin fecha` (default) y `📅 <fecha>` que abre el picker.
  - `minimumDate` = hoy (no permitir fechas pasadas al elegir).
- **Preview en vivo:** debajo de los campos, mientras hay monto > 0 y fecha elegida, mostrar
  `≈ $X/mes durante N meses`, recalculado con `monthlyTarget` sobre los valores del formulario (progreso = 0 al crear; progreso actual al editar).
- **Modo edición:** tocar la tarjeta de una meta abre el sheet precargado con nombre, monto y fecha. Guardar llama a `updateGoal`.

### Repo ([db/repos/goals.ts](../../../db/repos/goals.ts))

- `createGoal` acepta `targetDate?: string | null` y lo persiste.
- Nueva `updateGoal(db, id, patch: { name?; targetAmount?; targetDate?: string | null })`:
  - Reusa la validación de nombre no vacío y objetivo entero > 0.
  - No cambia `accountId` ni `manualAmount` (fuera de alcance de la edición).

### Validación ([lib/validation.ts](../../../lib/validation.ts))

- `goalSchema` gana `targetDate` opcional (`string ISO | null`).
- Si viene, debe ser una fecha válida; no se exige que sea futura en el schema (la UI ya lo limita), pero `monthlyTarget` maneja el caso vencido con gracia.

## Tests

Unitarios de `monthlyTarget` (Vitest, en [tests/](../../../tests/)):

- `sin_fecha` cuando `targetDate` es null.
- `completa` cuando progreso ≥ objetivo (con y sin fecha).
- `activa` mes actual = objetivo → `monthsLeft = 1`, `perMonth = remaining`.
- `activa` varios meses → `monthsLeft` correcto y `perMonth = ceil(remaining / monthsLeft)`.
- `vencida` cuando el mes objetivo ya pasó y falta dinero.
- Redondeo: `remaining` no divisible → `ceil` (ej. 100/3 → 34).

Opcional: test de `updateGoal` (nombre vacío / objetivo inválido lanzan).

## Riesgos / notas

- La migración se aplica al abrir la app vía `useMigrations` en [app/_layout.tsx](../../../app/_layout.tsx); confirmar que el archivo de migración se genere y quede incluido en `drizzle/migrations`.
- `monthsLeft` basado en año-mes ignora el día del mes a propósito, para que el sugerido sea estable dentro del mes y coincida con la intuición de "cuotas mensuales".
