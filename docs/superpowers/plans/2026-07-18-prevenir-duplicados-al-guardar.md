# Prevenir Duplicados al Guardar (Doble-Tap) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la creación de registros duplicados cuando el usuario toca dos veces el botón de guardar en los formularios de movimiento, cuenta y meta.

**Architecture:** (1) Fix de causa raíz en `app/movimiento/nuevo.tsx`: dejar de bloquear la navegación con un `await` de reprogramación de notificaciones — el guardado pasa a ser 100% síncrono hasta `router.back()`. (2) Defensa general: una prop `loading` en el componente `Button` compartido (muestra "Guardando..." y fuerza `disabled`), combinada en cada handler de guardado con un guard de reentrada basado en `useRef` (bloquea sincrónicamente, sin depender del batching de `useState`) y un `useState` que solo maneja la UI.

**Tech Stack:** React Native + Expo Router, TypeScript, Drizzle ORM sobre `expo-sqlite` (escrituras síncronas), NativeWind. Sin infraestructura de test para componentes UI (no hay `@testing-library/react-native` ni `jest-expo` en el proyecto); `vitest` solo cubre `lib/` y `db/repos/`.

## Global Constraints

- Label exacto para el estado de guardado: `"Guardando..."` (con puntos suspensivos, tal como aparece en el spec).
- El guard de reentrada usa el patrón: `const xRef = useRef(false)` chequeado como primera línea del handler (`if (xRef.current) return;`), más `const [x, setX] = useState(false)` para pasar a `loading` del `Button`. No usar un único `useState` para ambas cosas — el `ref` es necesario para bloquear sincrónicamente.
- Al abrir un formulario (`openCreate`, `openEdit`, o el `onPress` que abre un sheet), resetear el `ref` y el `state` de guardado correspondientes a `false`, igual que ya se resetea `error`/`setError('')` en esas funciones. Esto es necesario porque el `ref` vive en el componente padre (no se destruye al ocultar el sheet) y debe quedar limpio antes de la próxima apertura.
- En cada ruta de error (`catch`), resetear `xRef.current = false` y `setX(false)` antes de `return`, para permitir reintentar.
- En la ruta de éxito, **no** hace falta resetear el `state` de guardado si el formulario se oculta o navega fuera — el reset ocurre en la próxima apertura (ver punto anterior). Si el flujo no navega ni oculta nada, sí hay que resetear (no aplica a ninguna tarea de este plan).
- Este proyecto no tiene tests automatizados de componentes UI. La validación objetiva de cada tarea es `npm run typecheck` (debe salir sin errores) más una verificación manual descrita en cada tarea. No se introduce infraestructura de testing nueva (fuera de alcance del spec).
- No tocar `onNoSpend`, `onRemove`/`onDelete` (usan `Alert.alert`, que ya serializa la interacción) ni el botón "Cancelar" de ningún sheet — están fuera de alcance según el spec.

---

### Task 1: Prop `loading` en el componente `Button`

**Files:**
- Modify: `components/ui/Button.tsx`

**Interfaces:**
- Consumes: nada nuevo (mismo `AnimatedPressable`, `useTheme`).
- Produces: `Button` acepta ahora `loading?: boolean`. Cuando es `true`: el texto mostrado es `"Guardando..."` (ignora `label`) y el botón se comporta como `disabled` (no dispara `onPress`, opacidad 0.4). Las tareas 2-5 dependen de esta prop.

- [ ] **Step 1: Reemplazar el contenido de `components/ui/Button.tsx`**

```tsx
import { Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';
import { AnimatedPressable } from './AnimatedPressable';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Estilos inline (no NativeWind): ver comentario en AnimatedPressable.tsx.
export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const t = useTheme();
  const ghost = variant === 'ghost';
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? t.neg : t.card;
  const isDisabled = disabled || loading;
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        {
          alignItems: 'center',
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: bg,
          borderWidth: ghost ? 1 : 0,
          borderColor: t.border,
          opacity: isDisabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: ghost ? t.textSub : t.onPrimary }}>
        {loading ? 'Guardando...' : label}
      </Text>
    </AnimatedPressable>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npm run typecheck`
Expected: termina sin errores (sin salida de `tsc`).

- [ ] **Step 3: Commit**

```bash
git add components/ui/Button.tsx
git commit -m "feat(ui): boton Button soporta estado loading (Guardando...)"
```

---

### Task 2: Causa raíz — guardado síncrono e instantáneo en `movimiento/nuevo.tsx`

**Files:**
- Modify: `app/movimiento/nuevo.tsx`

**Interfaces:**
- Consumes: `Button` con prop `loading` (Task 1).
- Produces: nada consumido por otras tareas (archivo independiente de cuentas/metas/edición).

- [ ] **Step 1: Ampliar el import de React para incluir `useRef`**

En la línea 5, reemplazar:

```tsx
import { useState } from 'react';
```

por:

```tsx
import { useRef, useState } from 'react';
```

- [ ] **Step 2: Importar `ensureAppState` de forma estática (elimina el `import()` dinámico redundante)**

En la línea 14, reemplazar:

```tsx
import { displayStreak, logToday } from '../../db/repos/streak';
```

por:

```tsx
import { displayStreak, ensureAppState, logToday } from '../../db/repos/streak';
```

(El módulo `db/repos/streak` ya se cargaba estáticamente para `displayStreak`/`logToday`; el `await import(...)` que hacía `onSave` para `ensureAppState` era una vuelta asíncrona innecesaria — parte de la causa del retraso antes de navegar.)

- [ ] **Step 3: Añadir el guard de guardado**

Justo después de la línea `const [error, setError] = useState('');` (línea 46), añadir:

```tsx
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
```

- [ ] **Step 4: Reescribir `onSave` para que sea síncrono, con guard de reentrada, y sin esperar el reagendado de notificaciones antes de navegar**

Reemplazar el bloque completo de `onSave` (líneas 67-93):

```tsx
  async function onSave() {
    const candidate = {
      kind,
      amount: parseAmount(amountDigits),
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
```

por:

```tsx
  function onSave() {
    if (savingRef.current) return;
    const candidate = {
      kind,
      amount: parseAmount(amountDigits),
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
    savingRef.current = true;
    setSaving(true);
    try {
      createTransaction(db, parsed.data, today);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando');
      savingRef.current = false;
      setSaving(false);
      return;
    }
    if (date === today) {
      // No se espera: afterLog() ya atrapa sus propios errores y no debe
      // retrasar la navegación (era la causa del bug de doble-tap).
      afterLog(ensureAppState(db));
    }
    router.back();
  }
```

- [ ] **Step 5: Pasar `loading` al botón "Guardar"**

En la línea 204, reemplazar:

```tsx
        <Button style={{ flex: 1 }} label="Guardar" onPress={onSave} />
```

por:

```tsx
        <Button style={{ flex: 1 }} label="Guardar" loading={saving} onPress={onSave} />
```

- [ ] **Step 6: Verificar tipos**

Run: `npm run typecheck`
Expected: termina sin errores.

- [ ] **Step 7: Verificación manual**

Con la app corriendo (`npm run android` o `npm run ios`): ir a Movimientos → botón `+` → crear un ingreso con fecha "Hoy", monto y cuenta válidos. Tocar "Guardar" dos veces lo más rápido posible.

Expected:
- Solo se crea **un** movimiento en la lista (antes del fix, ocasionalmente se creaban dos).
- La navegación de vuelta a la lista ocurre de inmediato al primer tap (sin el retraso previo).
- Repetir con fecha distinta a "Hoy" (p. ej. "Ayer") para confirmar que el flujo también sigue funcionando en ese camino (no pasa por `afterLog`).

- [ ] **Step 8: Commit**

```bash
git add app/movimiento/nuevo.tsx
git commit -m "fix(movimiento): guardado sincrono e instantaneo, evita duplicados por doble-tap"
```

---

### Task 3: Guard de guardado en `movimiento/[id].tsx` (editar movimiento)

**Files:**
- Modify: `app/movimiento/[id].tsx`

**Interfaces:**
- Consumes: `Button` con prop `loading` (Task 1).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Ampliar el import de React para incluir `useRef`**

En la línea 5, reemplazar:

```tsx
import { useEffect, useState } from 'react';
```

por:

```tsx
import { useEffect, useRef, useState } from 'react';
```

- [ ] **Step 2: Añadir el guard de guardado**

Justo después de `const [loaded, setLoaded] = useState(false);` (línea 34), añadir:

```tsx
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
```

- [ ] **Step 3: Reescribir `onSave` con guard de reentrada**

Reemplazar el bloque completo de `onSave` (líneas 50-72):

```tsx
  function onSave() {
    const parsed = makeTransactionSchema(today).safeParse({
      kind: tx!.kind,
      amount: parseAmount(amountText),
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
```

por:

```tsx
  function onSave() {
    if (savingRef.current) return;
    const parsed = makeTransactionSchema(today).safeParse({
      kind: tx!.kind,
      amount: parseAmount(amountText),
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
    savingRef.current = true;
    setSaving(true);
    try {
      const { kind: _kind, ...patch } = parsed.data;
      updateTransaction(db, txId, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error guardando');
      savingRef.current = false;
      setSaving(false);
      return;
    }
    router.back();
  }
```

- [ ] **Step 4: Pasar `loading` al botón "Guardar cambios"**

En la línea 139, reemplazar:

```tsx
      <Button label="Guardar cambios" onPress={onSave} />
```

por:

```tsx
      <Button label="Guardar cambios" loading={saving} onPress={onSave} />
```

- [ ] **Step 5: Verificar tipos**

Run: `npm run typecheck`
Expected: termina sin errores.

- [ ] **Step 6: Verificación manual**

Abrir un movimiento existente desde la lista de Movimientos, cambiar el monto, tocar "Guardar cambios" dos veces rápido.

Expected: el movimiento se actualiza una sola vez (sin error), el botón muestra brevemente "Guardando..." y la navegación de vuelta ocurre normalmente.

- [ ] **Step 7: Commit**

```bash
git add app/movimiento/[id].tsx
git commit -m "fix(movimiento): guard de doble-tap al guardar cambios"
```

---

### Task 4: Guard de guardado en `cuentas.tsx` (crear/editar cuenta y pagar tarjeta)

**Files:**
- Modify: `app/(tabs)/cuentas.tsx`

**Interfaces:**
- Consumes: `Button` con prop `loading` (Task 1).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Ampliar el import de React para incluir `useRef`**

En la línea 4, reemplazar:

```tsx
import { useState } from 'react';
```

por:

```tsx
import { useRef, useState } from 'react';
```

- [ ] **Step 2: Añadir los guards de guardado (cuenta y pago)**

Justo después de `const [error, setError] = useState('');` (línea 45), añadir:

```tsx
  const [savingAccount, setSavingAccount] = useState(false);
  const savingAccountRef = useRef(false);
```

Justo después de `const [payError, setPayError] = useState('');` (línea 53), añadir:

```tsx
  const [savingPay, setSavingPay] = useState(false);
  const savingPayRef = useRef(false);
```

- [ ] **Step 3: Resetear el guard de cuenta al abrir el sheet**

En `openCreate` (líneas 55-64), añadir la línea de reset justo antes de `setError('');`:

```tsx
  function openCreate() {
    setEditingId(-1);
    setName('');
    setType('debito');
    setBalanceText('');
    setCupoText('');
    setCutoffText('');
    setDueText('');
    savingAccountRef.current = false;
    setSavingAccount(false);
    setError('');
  }
```

En `openEdit` (líneas 66-75), añadir la misma línea de reset justo antes de `setError('');`:

```tsx
  function openEdit(a: Account) {
    setEditingId(a.id);
    setName(a.name);
    setType(a.type);
    setBalanceText(a.type === 'credito' && a.initialBalance < 0 ? String(-a.initialBalance) : String(a.initialBalance));
    setCupoText(a.creditLimit != null ? String(a.creditLimit) : '');
    setCutoffText(a.cutoffDay != null ? String(a.cutoffDay) : '');
    setDueText(a.dueDay != null ? String(a.dueDay) : '');
    savingAccountRef.current = false;
    setSavingAccount(false);
    setError('');
  }
```

- [ ] **Step 4: Reescribir `onSubmit` (cuenta) con guard de reentrada**

Reemplazar el bloque completo de `onSubmit` (líneas 77-111):

```tsx
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
      if (isEditing && editingId != null) {
        if (isCredito) {
          // No re-anclar la deuda: initialBalance no refleja los gastos acumulados,
          // así que se omite del patch para no duplicar cardDebt.
          const { name, type, creditLimit, cutoffDay, dueDay } = parsed.data;
          updateAccount(db, editingId, { name, type, creditLimit, cutoffDay, dueDay });
        } else {
          updateAccount(db, editingId, parsed.data);
        }
      } else {
        createAccount(db, parsed.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      return;
    }
    setEditingId(null);
  }
```

por:

```tsx
  function onSubmit() {
    if (savingAccountRef.current) return;
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
    savingAccountRef.current = true;
    setSavingAccount(true);
    try {
      if (isEditing && editingId != null) {
        if (isCredito) {
          // No re-anclar la deuda: initialBalance no refleja los gastos acumulados,
          // así que se omite del patch para no duplicar cardDebt.
          const { name, type, creditLimit, cutoffDay, dueDay } = parsed.data;
          updateAccount(db, editingId, { name, type, creditLimit, cutoffDay, dueDay });
        } else {
          updateAccount(db, editingId, parsed.data);
        }
      } else {
        createAccount(db, parsed.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      savingAccountRef.current = false;
      setSavingAccount(false);
      return;
    }
    setEditingId(null);
  }
```

- [ ] **Step 5: Resetear el guard de pago al abrir el sheet de pago**

En `openPay` (líneas 113-120), añadir la línea de reset justo antes de `setPayError('');`:

```tsx
  function openPay(card: Account) {
    setPayCard(card);
    setPayAmountText(String(cardDebt(card, txs ?? [])));
    setPayAccountId(null);
    setPayDate(today);
    setShowPayPicker(false);
    savingPayRef.current = false;
    setSavingPay(false);
    setPayError('');
  }
```

- [ ] **Step 6: Reescribir `onPay` con guard de reentrada**

Reemplazar el bloque completo de `onPay` (líneas 122-139):

```tsx
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

por:

```tsx
  function onPay() {
    if (savingPayRef.current) return;
    if (payAccountId == null) {
      setPayError('Elige la cuenta de origen');
      return;
    }
    savingPayRef.current = true;
    setSavingPay(true);
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
      savingPayRef.current = false;
      setSavingPay(false);
    }
  }
```

- [ ] **Step 7: Pasar `loading` a los botones "Crear"/"Guardar" y "Pagar"**

En la línea 272, reemplazar:

```tsx
              <Button style={{ flex: 1 }} label={isEditing ? 'Guardar' : 'Crear'} onPress={onSubmit} />
```

por:

```tsx
              <Button style={{ flex: 1 }} label={isEditing ? 'Guardar' : 'Crear'} loading={savingAccount} onPress={onSubmit} />
```

En la línea 314, reemplazar:

```tsx
            <Button style={{ flex: 1 }} label="Pagar" onPress={onPay} />
```

por:

```tsx
            <Button style={{ flex: 1 }} label="Pagar" loading={savingPay} onPress={onPay} />
```

- [ ] **Step 8: Verificar tipos**

Run: `npm run typecheck`
Expected: termina sin errores.

- [ ] **Step 9: Verificación manual**

En la pestaña Cuentas: crear una cuenta nueva tocando "Crear" dos veces rápido → confirmar que solo aparece una cuenta en la lista. Editar una cuenta existente y tocar "Guardar" dos veces rápido → confirmar que no se duplica ni falla. Con una tarjeta de crédito con deuda, abrir "Pagar", completar el formulario y tocar "Pagar" dos veces rápido → confirmar que solo se crea una transacción de pago (revisar Movimientos).

- [ ] **Step 10: Commit**

```bash
git add "app/(tabs)/cuentas.tsx"
git commit -m "fix(cuentas): guard de doble-tap al crear/editar cuenta y pagar tarjeta"
```

---

### Task 5: Guard de guardado en `metas.tsx` (crear/editar meta y abonar)

**Files:**
- Modify: `app/(tabs)/metas.tsx`

**Interfaces:**
- Consumes: `Button` con prop `loading` (Task 1).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Ampliar el import de React para incluir `useRef`**

En la línea 5, reemplazar:

```tsx
import { useState } from 'react';
```

por:

```tsx
import { useRef, useState } from 'react';
```

- [ ] **Step 2: Añadir los guards de guardado (meta y abono)**

Justo después de `const [error, setError] = useState('');` (línea 39), añadir:

```tsx
  const [savingGoal, setSavingGoal] = useState(false);
  const savingGoalRef = useRef(false);
```

Justo después de `const [abonoError, setAbonoError] = useState('');` (línea 43), añadir:

```tsx
  const [savingAbono, setSavingAbono] = useState(false);
  const savingAbonoRef = useRef(false);
```

- [ ] **Step 3: Resetear el guard de meta al abrir el sheet**

En `openCreate` (líneas 45-54), añadir la línea de reset justo antes de `setError('');`:

```tsx
  function openCreate() {
    setIsEditing(false);
    setFormGoalId(-1); // -1 = creando (no hay id todavía)
    setName('');
    setTargetText('');
    setLinkedAccountId(null);
    setTargetDate(null);
    setShowDatePicker(false);
    savingGoalRef.current = false;
    setSavingGoal(false);
    setError('');
  }
```

En `openEdit` (líneas 56-65), añadir la misma línea de reset justo antes de `setError('');`:

```tsx
  function openEdit(g: Goal) {
    setIsEditing(true);
    setFormGoalId(g.id);
    setName(g.name);
    setTargetText(String(g.targetAmount));
    setLinkedAccountId(g.accountId ?? null);
    setTargetDate(g.targetDate ?? null);
    setShowDatePicker(false);
    savingGoalRef.current = false;
    setSavingGoal(false);
    setError('');
  }
```

- [ ] **Step 4: Reescribir `onSubmit` (meta) con guard de reentrada**

Reemplazar el bloque completo de `onSubmit` (líneas 71-93):

```tsx
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

por:

```tsx
  function onSubmit() {
    if (savingGoalRef.current) return;
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
    savingGoalRef.current = true;
    setSavingGoal(true);
    try {
      if (isEditing && formGoalId != null && formGoalId > 0) {
        updateGoal(db, formGoalId, { name: parsed.data.name, targetAmount: parsed.data.targetAmount, targetDate: parsed.data.targetDate ?? null });
      } else {
        createGoal(db, parsed.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      savingGoalRef.current = false;
      setSavingGoal(false);
      return;
    }
    closeForm();
  }
```

- [ ] **Step 5: Resetear el guard de abono al abrir su sheet, y reescribir `onAbonar` con guard de reentrada**

El sheet de abono se abre inline desde el `Pressable` de la lista (línea 174-179). Reemplazar:

```tsx
                  <Pressable
                    onPress={() => setAbonarGoalId(g.id)}
                    className="rounded-full bg-primary px-3.5 py-[7px] dark:bg-primary-dark"
                  >
```

por:

```tsx
                  <Pressable
                    onPress={() => {
                      savingAbonoRef.current = false;
                      setSavingAbono(false);
                      setAbonarGoalId(g.id);
                    }}
                    className="rounded-full bg-primary px-3.5 py-[7px] dark:bg-primary-dark"
                  >
```

Reemplazar el bloque completo de `onAbonar` (líneas 115-124):

```tsx
  function onAbonar() {
    try {
      addToGoal(db, abonarGoalId!, parseAmount(abonoText || '0'));
      setAbonarGoalId(null);
      setAbonoText('');
      setAbonoError('');
    } catch (e) {
      setAbonoError(e instanceof Error ? e.message : 'Error');
    }
  }
```

por:

```tsx
  function onAbonar() {
    if (savingAbonoRef.current) return;
    savingAbonoRef.current = true;
    setSavingAbono(true);
    try {
      addToGoal(db, abonarGoalId!, parseAmount(abonoText || '0'));
      setAbonarGoalId(null);
      setAbonoText('');
      setAbonoError('');
    } catch (e) {
      setAbonoError(e instanceof Error ? e.message : 'Error');
      savingAbonoRef.current = false;
      setSavingAbono(false);
    }
  }
```

- [ ] **Step 6: Pasar `loading` a los botones "Crear"/"Guardar" y "Abonar"**

En la línea 263, reemplazar:

```tsx
              <Button style={{ flex: 1 }} label={isEditing ? 'Guardar' : 'Crear'} onPress={onSubmit} />
```

por:

```tsx
              <Button style={{ flex: 1 }} label={isEditing ? 'Guardar' : 'Crear'} loading={savingGoal} onPress={onSubmit} />
```

En la línea 280, reemplazar:

```tsx
              <Button style={{ flex: 1 }} label="Abonar" onPress={onAbonar} />
```

por:

```tsx
              <Button style={{ flex: 1 }} label="Abonar" loading={savingAbono} onPress={onAbonar} />
```

- [ ] **Step 7: Verificar tipos**

Run: `npm run typecheck`
Expected: termina sin errores.

- [ ] **Step 8: Verificación manual**

En la pestaña Metas: crear una meta nueva tocando "Crear" dos veces rápido → confirmar que solo aparece una meta. Editar una meta existente y tocar "Guardar" dos veces rápido → confirmar que no falla ni duplica. Para una meta manual (sin cuenta ligada), tocar "Abonar", completar el monto y tocar "Abonar" dos veces rápido → confirmar que el progreso solo sube una vez.

- [ ] **Step 9: Commit**

```bash
git add "app/(tabs)/metas.tsx"
git commit -m "fix(metas): guard de doble-tap al crear/editar meta y abonar"
```

---

## Verificación final (todas las tareas)

- [ ] **Step 1: Suite completa**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: los tres comandos terminan sin errores.

- [ ] **Step 2: Smoke manual cruzado**

Repetir el doble-tap descrito en cada tarea (movimiento nuevo con fecha hoy, editar movimiento, crear/editar cuenta, pagar tarjeta, crear/editar meta, abonar) en una sola sesión de la app, confirmando que ningún botón queda atascado en "Guardando..." y que no aparecen registros duplicados en ningún caso.
