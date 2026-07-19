# Prevenir duplicados al guardar (doble-tap)

## Problema

Al añadir un ingreso, gasto, transferencia, cuenta o meta, el botón de guardar
ocasionalmente permite un segundo tap antes de que la pantalla reaccione
(navegue o cierre el formulario), creando un registro duplicado en la base
de datos.

## Causa raíz confirmada

En [app/movimiento/nuevo.tsx](../../../app/movimiento/nuevo.tsx) `onSave()`
inserta el movimiento de forma síncrona, pero cuando la fecha es "hoy" (el
caso más frecuente) espera (`await`) a `afterLog()` →
`rescheduleReminders()` antes de llamar a `router.back()`. Esa función
carga `expo-notifications` dinámicamente, cancela y reprograma
notificaciones — trabajo asíncrono que puede tardar varios cientos de
milisegundos. Durante esa ventana el botón "Guardar" sigue habilitado, así
que un doble-tap dispara `onSave()` dos veces antes de que ocurra la
navegación, insertando dos movimientos.

Los formularios de `cuentas.tsx` y `metas.tsx` son síncronos (cierran un
sheet local, no navegan), por lo que el mismo riesgo es más sutil — un
doble-tap muy rápido aún podría colarse antes de que React re-renderice y
oculte el sheet.

## Diseño

### 1. Fix de causa raíz: no bloquear la navegación en trabajo secundario

En `app/movimiento/nuevo.tsx`, `onSave()` deja de esperar a
`rescheduleReminders()` antes de navegar. El flujo pasa a ser:

1. Insertar el movimiento (síncrono).
2. Si `date === today`, actualizar la racha (`ensureAppState`, síncrono) y
   navegar de inmediato con `router.back()`.
3. Disparar `rescheduleReminders()` en segundo plano, sin `await`, con
   `.catch(() => {})` (ya existente) para que un fallo no afecte al
   usuario.

Esto además cumple el objetivo de que la redirección sea instantánea.

### 2. Bloqueo de botón como defensa general en todos los formularios de guardado

**`components/ui/Button.tsx`** gana una prop opcional `loading?: boolean`:

- Cuando `loading` es `true`, el label mostrado pasa a ser `"Guardando..."`
  y el botón queda forzado a `disabled` (reutilizando el estilo de opacidad
  reducida que ya existe para `disabled`).
- `disabled` sigue funcionando igual cuando `loading` es `false`/`undefined`
  (comportamiento actual sin cambios).

Cada handler de guardado gana:

- Un `useRef<boolean>` (p. ej. `savingRef`) chequeado al inicio del handler:
  si ya es `true`, el handler retorna de inmediato. Esto protege contra
  reentradas en el mismo tick, algo que un `useState` no garantiza por el
  batching de React.
- Un `useState<boolean>` (`saving`) que solo controla la UI: se pasa como
  `loading` al `Button` correspondiente.
- Si la validación (`safeParse`) falla o el repo lanza una excepción
  (`try/catch` ya existentes), se resetean `savingRef.current = false` y
  `setSaving(false)` antes de `return`, para permitir reintentar.
- Si la operación tiene éxito, no hace falta resetear el estado porque el
  componente navega fuera (`router.back()`) o el formulario se oculta
  (`setEditingId(null)`, `closeForm()`, `setPayCard(null)`,
  limpieza de `abonarGoalId`).

### Formularios y botones afectados

| Archivo | Handler | Botón |
|---|---|---|
| `app/movimiento/nuevo.tsx` | `onSave` | "Guardar" |
| `app/movimiento/[id].tsx` | `onSave` | "Guardar cambios" |
| `app/(tabs)/cuentas.tsx` | `onSubmit` | "Crear" / "Guardar" (cuenta) |
| `app/(tabs)/cuentas.tsx` | `onPay` | "Pagar" (tarjeta) |
| `app/(tabs)/metas.tsx` | `onSubmit` | "Crear" / "Guardar" (meta) |
| `app/(tabs)/metas.tsx` | `onAbonar` | "Abonar" |

`onNoSpend`, `onDelete`/`onRemove` (con confirmación vía `Alert.alert`) y el
botón "Cancelar" quedan fuera de alcance: los borrados/confirmaciones no
sufren el mismo patrón de duplicados y `Alert.alert` ya serializa la
interacción.

### 3. Manejo de errores

Sin cambios en la lógica de validación existente. La única adición es
resetear `saving`/`savingRef` en las rutas de error para que el botón
vuelva a su estado normal y el usuario pueda corregir y reintentar.

### 4. Testing

No existe una suite automatizada para estas pantallas (dependen de SQLite
en dispositivo/emulador). La verificación es manual:

- Reproducir un doble-tap rápido en "Guardar" de `nuevo.tsx` con fecha
  "Hoy", antes y después del fix, confirmando que solo se crea un
  movimiento y que la navegación es instantánea.
- Confirmar visualmente el estado "Guardando..." (label + opacidad) en
  cada uno de los seis botones listados arriba.
- Confirmar que un error de validación deja el botón utilizable de nuevo
  (no se queda en "Guardando..." de forma permanente).
