# Botones de acción invisibles (Button / AddButton / FAB) — diseño del fix

**Fecha:** 2026-07-13

## Problema

En el APK los tres únicos consumidores de `AnimatedPressable` se renderizan sin sus
clases de NativeWind: el registro manual `cssInterop(AnimatedPressableBase, …)` no
surte efecto en el dispositivo (NativeWind 4.2.6 + Reanimated 4.5.0, Expo 57).
Resultado: sin fondo, sin padding, texto `onPrimary` (blanco en claro / casi negro
en oscuro) sobre el fondo de pantalla → botones invisibles pero tocables.

Síntomas reportados que explica:
- Onboarding: "no existe el botón para continuar" (`Button` "Empezar").
- Cuentas/Metas: el botón "+ Nueva" no se ve (`AddButton`, agravado por `entering={BounceIn}`,
  que puede dejar el view en escala 0 si la animación de entrada no corre).
- Crear/Guardar/Abonar poco visibles (`Button` primario en modales).
- El FAB "+" central se ve verde (color por `style` inline) pero deforme (tamaño/forma iban por `className`).

## Decisión (opción A aprobada)

Eliminar la dependencia de `cssInterop` para estos componentes: todo lo visual pasa a
`style` inline usando los tokens de `useTheme()` (ya responden a dark mode).

1. `components/ui/AnimatedPressable.tsx`: quitar el registro `cssInterop` y el soporte
   implícito de `className`; el componente se estiliza solo por `style`.
2. `components/ui/Button.tsx`: variantes primary/ghost/danger con estilos inline;
   prop `className` se reemplaza por `style?: StyleProp<ViewStyle>` (los call sites
   con `className="flex-1"` pasan `style={{ flex: 1 }}`).
3. `components/ui/AddButton.tsx`: estilos inline y **sin** `BounceIn` (preferencia del
   usuario: animación mínima; solo queda el feedback de escala al presionar).
4. FAB en `app/(tabs)/_layout.tsx`: tamaño/forma/márgenes a `style` inline.
5. Onboarding: mover `p-6` del `ScrollView` a `contentContainerClassName` (el padding
   directo en el ScrollView recorta el final del contenido en Android).

## No-objetivos

- No se intenta arreglar el registro de cssInterop (no reproducible en este entorno).
- No se tocan componentes que ya funcionan (Pressable/View/Text nativos con className).

## Verificación

`npx tsc --noEmit`, `npx vitest run`, revisión de contraste de las variantes
(danger: texto sobre `neg` debe cumplir 4.5:1) y confirmación final en dispositivo
por el usuario (sin adb en esta máquina).
