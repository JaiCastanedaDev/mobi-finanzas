# Mobi Finanzas — Diseño v1

**Fecha:** 2026-07-08
**Estado:** Aprobado en brainstorming, pendiente de plan de implementación

## Qué es

App móvil personal de finanzas, 100% local y offline, para un solo usuario (el dueño del teléfono). Registro de gastos/ingresos/transferencias sobre cuentas propias, dashboard con gráficas, metas de ahorro, y un gancho de hábito diario: racha de días consecutivos con recordatorio por notificación local.

Proyecto desde cero; no existe código previo que reusar.

## Alcance v1

Incluido:

- Registro de movimientos (gasto, ingreso, transferencia) sobre cuentas y categorías.
- Dashboard: balance del mes, dona de gastos por categoría, evolución del balance (6 meses), racha, acceso rápido a metas.
- Racha diaria + notificación local configurable.
- Metas de ahorro (ligadas a cuenta o manuales).
- Onboarding mínimo de primera ejecución.

Fuera de v1:

- Múltiples usuarios, sincronización, backend de cualquier tipo.
- Multi-moneda (solo COP, enteros, sin decimales).
- Presupuestos por categoría, exportación de datos, tests E2E.

## Stack

| Capa | Elección |
|---|---|
| Base | Expo (React Native + TypeScript), Expo Router |
| UI | NativeWind + componentes propios, `lucide-react-native` |
| Gráficas | `react-native-gifted-charts` (elegido sobre victory-native: sin dependencia de Skia/Reanimated, API más simple para dona + línea) |
| Formularios | React Hook Form + Zod |
| Estado UI efímero | Zustand (filtro de mes activo, etc.) |
| Datos | expo-sqlite + Drizzle ORM (migraciones con Drizzle Kit, lecturas con `useLiveQuery`) |
| Preferencias chicas | `expo-sqlite/kv-store` (hora del recordatorio, tema). API síncrona tipo storage; se eligió sobre MMKV porque MMKV requiere development build y la verificación de v1 es en Expo Go |
| Notificaciones | `expo-notifications` (locales, sin servidor) |

## Arquitectura de datos (Enfoque A: lecturas vivas + repositorios)

- **Lecturas:** las pantallas consultan la DB directamente con `useLiveQuery` de Drizzle. Toda la UI (dashboard, saldos, racha) se refresca sola al escribir.
- **Escrituras:** pasan por módulos de repositorio por dominio (`db/repos/transactions.ts`, `accounts.ts`, `goals.ts`, `streak.ts`) — funciones puras sin React que encapsulan la lógica de negocio y son testeables de forma aislada.
- **Zustand** solo para estado efímero de UI. Nunca espeja datos de la DB (una sola fuente de verdad).
- Escrituras multi-tabla (movimiento + racha) van en **transacción SQLite**: o todo o nada.

Enfoques descartados: capa de servicios con hooks envoltorio (indirección sin retorno para una app local de un usuario) y store central en Zustand espejando la DB (doble fuente de verdad).

## Navegación y pantallas

```
app/
├── _layout.tsx              → raíz: provider de DB, migraciones, tema
├── (tabs)/
│   ├── _layout.tsx          → tab bar
│   ├── index.tsx            → 🏠 Dashboard
│   ├── movimientos.tsx      → 📋 Lista de transacciones (filtros por mes/categoría)
│   ├── cuentas.tsx          → 💳 Cuentas con saldos
│   └── metas.tsx            → 🎯 Metas de ahorro
├── movimiento/
│   ├── nuevo.tsx            → modal: registrar movimiento
│   └── [id].tsx             → ver/editar/borrar movimiento
└── ajustes.tsx              → recordatorio, tema, gestión de categorías
```

- **Flujo clave:** botón `+` flotante siempre visible → modal de nuevo movimiento: monto (teclado numérico grande), tipo, categoría (grid de íconos), cuenta, fecha (hoy por defecto), nota opcional. Mínimos toques posibles.
- Ajustes se abre desde un engranaje en el header del dashboard (no gasta tab). La gestión de categorías vive dentro de Ajustes.
- El filtro de mes (Zustand) lo comparten Dashboard y Movimientos.

## Modelo de datos

Montos siempre en **pesos enteros (COP)**, positivos; el signo lo da el tipo. Fechas: `YYYY-MM-DD` (texto) para el día del movimiento; datetime ISO para timestamps.

### `accounts`
| Campo | Tipo | Nota |
|---|---|---|
| id | integer PK | |
| name | text | único entre activas |
| type | text | `'debito' \| 'ahorro' \| 'efectivo'` |
| initialBalance | integer | saldo al crear la cuenta |
| archivedAt | text \| null | |
| createdAt | text | |

### `categories`
| Campo | Tipo | Nota |
|---|---|---|
| id | integer PK | |
| name | text | único entre activas |
| kind | text | `'gasto' \| 'ingreso'` |
| icon | text | nombre de ícono lucide |
| color | text | hex |
| archivedAt | text \| null | |

### `transactions`
| Campo | Tipo | Nota |
|---|---|---|
| id | integer PK | |
| kind | text | `'gasto' \| 'ingreso' \| 'transferencia'` |
| amount | integer | > 0 |
| date | text | `YYYY-MM-DD`, no futura |
| accountId | integer FK | origen en gasto/transferencia; destino en ingreso |
| toAccountId | integer \| null FK | solo transferencias (destino) |
| categoryId | integer \| null FK | null en transferencias |
| note | text \| null | |
| createdAt | text | |

### `savings_goals`
| Campo | Tipo | Nota |
|---|---|---|
| id | integer PK | |
| name | text | |
| targetAmount | integer | |
| accountId | integer \| null FK | si está ligada: progreso = saldo de esa cuenta |
| manualAmount | integer | progreso si es manual (botón "Abonar") |
| createdAt | text | |

### `app_state` (una sola fila, id = 1)
| Campo | Tipo | Nota |
|---|---|---|
| currentStreak | integer | |
| bestStreak | integer | |
| lastLoggedDate | text \| null | último día con registro |

### Reglas del modelo

- **Transferencia = una sola fila** (origen + destino), no dos movimientos espejo. Editar/borrar nunca deja mitades huérfanas. Las estadísticas excluyen `kind = 'transferencia'`.
- **Saldo de cuenta derivado, nunca almacenado:** `initialBalance + ingresos − gastos − transferencias salientes + transferencias entrantes` (query agregada).
- **Archivar en vez de borrar** cuentas/categorías con movimientos; sin movimientos se borran de verdad. Las archivadas desaparecen de los selectores pero el historial queda intacto.
- **Categorías semilla** en primera ejecución: gasto → mercado, transporte, arriendo, comida fuera, servicios, salud, ocio, ropa, educación, otros; ingreso → salario, ventas, regalos, otros. Todas editables.

## Racha y notificación diaria

**Qué cuenta:** registrar al menos un movimiento hoy, o tocar el atajo **"Hoy no gasté"** en el modal de nuevo movimiento (actualiza `lastLoggedDate` sin crear transacción). La racha premia reportar, no gastar.

**Cálculo (solo al escribir, en el repo, nunca por timer):** al registrar hoy, comparar con `lastLoggedDate`:

1. Mismo día → sin cambios.
2. Ayer → `currentStreak + 1`; actualizar `bestStreak` si corresponde.
3. Antes de ayer o null → `currentStreak = 1`.

Movimientos con fecha pasada no afectan la racha (solo cuenta registrar *hoy*). Al mostrar: si `lastLoggedDate` es anterior a ayer, la racha se pinta como 0 aunque la fila diga otra cosa; la corrección se persiste en el siguiente registro.

**Notificación local** (`expo-notifications`), hora configurable en Ajustes (9 PM por defecto, apagable). Texto: "¿Registraste tus gastos de hoy? 🔥 Llevas N días". Implementación: se programan las próximas 7 notificaciones puntuales (una por día a la hora elegida) y se recalculan al abrir la app, al registrar un movimiento y al cambiar ajustes — así, si ya registraste hoy, la de hoy se cancela y la serie arranca mañana; el N es aproximado por naturaleza de las notificaciones programadas. Si el usuario no abre la app en más de 7 días, los recordatorios cesan hasta la próxima apertura (aceptable: dejó el hábito). Tocarla abre el modal de nuevo movimiento.

**Celebración:** badge/animación simple en el dashboard al cumplir hitos (3, 7, 14, 30, 60, 100 días), derivado de `currentStreak`/`bestStreak`. Sin sistema de logros persistente en v1.

## Dashboard

De arriba hacia abajo:

1. Encabezado: saludo + racha 🔥 + engranaje de Ajustes.
2. Balance del mes (ingresos − gastos) con selector de meses anteriores.
3. Dona de gastos por categoría del mes seleccionado: top 5 + "otras" agrupadas; tocar un segmento navega a Movimientos filtrado por esa categoría.
4. Evolución del balance: línea/área de los últimos 6 meses (ingresos − gastos por mes). Con menos de 2 meses de datos, se oculta y se muestra mensaje amable.
5. Tarjetas compactas de metas con barra de progreso.

Ambas gráficas salen de queries agregadas con `useLiveQuery` (`GROUP BY categoryId` / mes). Transferencias excluidas de todas las estadísticas.

## Metas de ahorro

- **Ligada a cuenta:** progreso = saldo actual de la cuenta. Se mueve con transferencias/ingresos a esa cuenta.
- **Manual:** progreso = `manualAmount`; botón "Abonar" suma un monto (no toca cuentas).
- Tarjeta: nombre, barra de progreso, acumulado vs objetivo, porcentaje. Al 100%: "¡Cumplida!" + opción de archivar.

## Primera ejecución

Onboarding de una pantalla: crear la primera cuenta (nombre, tipo, saldo inicial) y elegir hora del recordatorio (con solicitud del permiso de notificaciones). Las categorías semilla se insertan aquí. Sin al menos una cuenta no se puede registrar movimientos, así que el paso es obligatorio.

## Validación y casos borde

Validación (Zod + React Hook Form):

- Monto: entero > 0, tope < 10.000.000.000 (atrapa dedazos).
- Transferencia: origen ≠ destino, ambas obligatorias.
- Fecha no futura.
- Nombres de cuenta/categoría/meta: no vacíos, únicos entre activos.

Reglas:

- Borrar movimiento → confirmación simple; saldos y estadísticas se recalculan solos (nada precalculado).
- Editar movimiento: monto/cuenta/categoría/fecha editables; **el tipo no** — para cambiar tipo se borra y se crea de nuevo (evita estados inválidos).
- Saldo negativo permitido, con aviso visual en rojo.
- Permiso de notificaciones denegado: la app funciona igual; Ajustes muestra el estado con enlace a la configuración del sistema.

## Migraciones

Generadas por Drizzle Kit, ejecutadas al arrancar con `useMigrations`. La pantalla raíz no monta los tabs hasta que terminen; si fallan, pantalla de error (nunca app con esquema viejo).

## Testing

- **Unit (Vitest)** sobre la lógica pura de los repos, contra SQLite en memoria (`better-sqlite3` con el mismo esquema Drizzle): cálculo de racha (3 casos + fecha pasada), saldo derivado con transferencias, agregaciones del dashboard, esquemas Zod.
- **Sin E2E en v1**; verificación de UI manual en Expo Go.
