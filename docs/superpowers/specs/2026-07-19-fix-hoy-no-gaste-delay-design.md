# Fix: "Hoy no gasté" no reacciona hasta después de un retraso

## Problema

Al tocar el botón "Hoy no gasté 🙌" en [app/movimiento/nuevo.tsx](../../../app/movimiento/nuevo.tsx),
la pantalla no muestra ninguna reacción inmediata (ni Alert ni navegación).
Tras un retraso perceptible, el Alert de confirmación aparece junto con la
navegación de vuelta, mostrando la racha del día ya completada.

## Causa raíz confirmada

`onNoSpend()` (líneas 62-67) hace:

```ts
async function onNoSpend() {
  const state = logToday(db, today);
  await afterLog(state);
  Alert.alert('¡Listo!', `Día registrado. Racha: ${state.currentStreak} 🔥`);
  router.back();
}
```

`afterLog()` llama a `rescheduleReminders()`
([lib/notifications.ts](../../../lib/notifications.ts)), que carga
`expo-notifications` de forma dinámica, cancela todas las notificaciones
programadas y reprograma las nuevas — trabajo asíncrono que puede tardar de
cientos de milisegundos a un par de segundos según el dispositivo/permisos.
Como `onNoSpend` espera (`await`) ese trabajo antes de mostrar el `Alert` y
navegar, el usuario percibe que el botón "no hace nada" durante esa ventana.

Este es el mismo patrón de causa raíz que se identificó y arregló en
`onSave()` del mismo archivo (ver
[2026-07-18-prevenir-duplicados-al-guardar-design.md](2026-07-18-prevenir-duplicados-al-guardar-design.md)),
donde se dejó de esperar `rescheduleReminders()` antes de navegar. En ese
momento `onNoSpend` quedó explícitamente fuera de alcance porque el
problema atacado era duplicados por doble-tap, no la latencia de reacción.

## Diseño

`onNoSpend` deja de esperar (`await`) a `afterLog()` antes de reaccionar:

```ts
function onNoSpend() {
  const state = logToday(db, today);   // síncrono (SQLite local)
  afterLog(state).catch(() => {});     // se dispara en segundo plano
  Alert.alert('¡Listo!', `Día registrado. Racha: ${state.currentStreak} 🔥`);
  router.back();
}
```

- `logToday` es síncrono, así que `state.currentStreak` ya está calculado
  antes de mostrar el `Alert` — no se pierde información ni se muestra un
  valor incorrecto.
- `afterLog` internamente ya envuelve `rescheduleReminders(...).catch(() =>
  {})`, por lo que un fallo en notificaciones no debe romper nada; se
  añade un `.catch(() => {})` adicional al llamar `afterLog` por
  consistencia con el patrón ya usado en `onSave`.
- La función deja de ser `async` (ya no tiene ningún `await` dentro).
- No se toca `Button`/`savingRef`: `Alert.alert` sigue serializando la
  interacción, y al reaccionar de inmediato la ventana de doble-tap
  prácticamente desaparece.

## Fuera de alcance

- No se añade estado de "loading" al botón "Hoy no gasté 🙌": no aplica el
  mismo riesgo de duplicados que en `onSave` (no crea una transacción, y
  `logToday`/`nextStreak` son idempotentes para el mismo día).
- No se revisan otras pantallas: el único lugar donde este patrón
  (`await afterLog(...)` bloqueando navegación) sigue presente es
  `onNoSpend`; `onSave` ya fue corregido.

## Testing

No existe una suite automatizada para esta pantalla (depende de SQLite en
dispositivo/emulador). Verificación manual:

- Tocar "Hoy no gasté 🙌" y confirmar que el `Alert` + navegación ocurren
  de inmediato, tanto con permisos de notificación otorgados como
  denegados.
- Confirmar que la racha mostrada en el `Alert` sigue siendo correcta.
