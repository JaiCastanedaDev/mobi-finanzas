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
import { parseAmount } from '../../lib/money';
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
      amount: parseAmount(amountText),
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
