import DateTimePicker from '@react-native-community/datetimepicker';
import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryGrid } from '../../components/CategoryGrid';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, transactions } from '../../db/schema';
import { displayStreak, ensureAppState, logToday } from '../../db/repos/streak';
import { createTransaction } from '../../db/repos/transactions';
import { addDaysISO, todayISO } from '../../lib/dates';
import { formatCOP, parseAmount } from '../../lib/money';
import { cardAvailable } from '../../lib/calc';
import { useTheme } from '../../lib/theme';
import { rescheduleReminders } from '../../lib/notifications';
import { makeTransactionSchema } from '../../lib/validation';

const KINDS = [
  { value: 'gasto', label: 'Gasto' },
  { value: 'ingreso', label: 'Ingreso' },
  { value: 'transferencia', label: 'Transf.' },
] as const;

const groupDigits = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function NuevoMovimiento() {
  const today = todayISO();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: txs } = useLiveQuery(db.select().from(transactions));

  const [kind, setKind] = useState<'gasto' | 'ingreso' | 'transferencia'>('gasto');
  const [amountDigits, setAmountDigits] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const selectedAccount = (accs ?? []).find((a) => a.id === accountId);
  const overLimit =
    kind === 'gasto' && selectedAccount?.type === 'credito'
      ? parseAmount(amountDigits || '0') > cardAvailable(selectedAccount, txs ?? [])
      : false;
  const availableForCard =
    selectedAccount?.type === 'credito' ? cardAvailable(selectedAccount, txs ?? []) : 0;

  async function afterLog(streakState: { currentStreak: number; bestStreak: number; lastLoggedDate: string | null }) {
    await rescheduleReminders({ loggedToday: true, streak: displayStreak(streakState, today) }).catch(() => {});
  }

  async function onNoSpend() {
    const state = logToday(db, today);
    await afterLog(state);
    Alert.alert('¡Listo!', `Día registrado. Racha: ${state.currentStreak} 🔥`);
    router.back();
  }

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
      // retrasar la navegación (era la causa del bug de doble-tap). Se
      // envuelve en try/catch para que un fallo de ensureAppState tampoco
      // deje el guard armado sin navegar.
      try {
        afterLog(ensureAppState(db));
      } catch {
        // Efecto secundario (racha/notificaciones); no debe bloquear el guardado.
      }
    }
    router.back();
  }

  const cuentaLabel = kind === 'ingreso' ? 'Cuenta destino' : kind === 'transferencia' ? 'Cuenta origen' : 'Cuenta';

  return (
    <KeyboardAvoidingView
      className="flex-1"
      style={{ paddingTop: insets.top }}
      behavior="padding"
    >
    <ScrollView
      className="flex-1 bg-bg dark:bg-bg-dark"
      contentContainerClassName="px-4 pb-12 pt-[18px]"
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-3.5 h-1 w-9 self-center rounded-full bg-line dark:bg-line-dark" />
      <Text className="mb-3.5 text-base font-bold text-ink dark:text-ink-dark">Nuevo movimiento</Text>

      {/* Tipo */}
      <View className="mb-3.5 flex-row rounded-full border border-line bg-card p-1 dark:border-line-dark dark:bg-card-dark">
        {KINDS.map((k) => {
          const selected = kind === k.value;
          return (
            <Pressable
              key={k.value}
              onPress={() => {
                setKind(k.value);
                setCategoryId(null);
              }}
              className="flex-1 items-center rounded-full py-[9px]"
              style={{ backgroundColor: selected ? t.primary : 'transparent' }}
            >
              <Text className="text-[12.5px] font-semibold" style={{ color: selected ? t.onPrimary : t.textSub }}>
                {k.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Monto */}
      <View className="items-center py-2">
        <Text className="mb-1 text-[11px] font-medium text-sub dark:text-sub-dark">Monto</Text>
        <TextInput
          value={amountDigits ? groupDigits(amountDigits) : ''}
          onChangeText={(v) => setAmountDigits(v.replace(/\D/g, ''))}
          placeholder="0"
          placeholderTextColor={t.textSub}
          keyboardType="numeric"
          className="w-full text-center text-[32px] font-bold text-ink dark:text-ink-dark"
        />
      </View>

      <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Fecha</Text>
      <View className="mb-2 flex-row">
        <Chip label="Hoy" selected={date === today} onPress={() => setDate(today)} />
        <Chip label="Ayer" selected={date === addDaysISO(today, -1)} onPress={() => setDate(addDaysISO(today, -1))} />
        <Chip
          label={`📅 ${date}`}
          selected={date !== today && date !== addDaysISO(today, -1)}
          onPress={() => setShowPicker(true)}
        />
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

      <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">{cuentaLabel}</Text>
      <View className="mb-2 flex-row flex-wrap">
        {(accs ?? []).map((a) => (
          <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </View>

      {overLimit ? (
        <Text className="mb-2 text-[11px] font-medium text-neg dark:text-neg-dark">
          Excede el cupo disponible ({formatCOP(availableForCard)}). Puedes registrarlo igual.
        </Text>
      ) : null}

      {kind === 'transferencia' ? (
        <>
          <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Cuenta destino</Text>
          <View className="mb-2 flex-row flex-wrap">
            {(accs ?? []).map((a) => (
              <Chip key={a.id} label={a.name} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Categoría</Text>
          <CategoryGrid kind={kind} selectedId={categoryId} onSelect={setCategoryId} />
        </>
      )}

      <View className="mt-1">
        <Field label="Nota (opcional)" value={note} onChangeText={setNote} placeholder="Ej. Almuerzo con el equipo" />
      </View>

      {error ? <Text className="mb-3 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
      <View className="flex-row gap-2.5">
        <Button style={{ flex: 1 }} label="Cancelar" variant="ghost" onPress={() => router.back()} />
        <Button style={{ flex: 1 }} label="Guardar" loading={saving} onPress={onSave} />
      </View>
      <View className="h-3" />
      <Button label="Hoy no gasté 🙌" variant="ghost" onPress={onNoSpend} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
