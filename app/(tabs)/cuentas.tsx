import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AddButton } from '../../components/ui/AddButton';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, transactions } from '../../db/schema';
import { createAccount, removeAccount, updateAccount } from '../../db/repos/accounts';
import { createTransaction } from '../../db/repos/transactions';
import { accountBalance, cardAvailable, cardDebt } from '../../lib/calc';
import { dayLabel, nextDateForDay, todayISO } from '../../lib/dates';
import { formatCOP, parseAmount } from '../../lib/money';
import { useTheme } from '../../lib/theme';
import { accountSchema } from '../../lib/validation';

const TIPOS = [
  { value: 'debito', label: 'Débito' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'credito', label: 'Crédito' },
] as const;

export default function Cuentas() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: txs } = useLiveQuery(db.select().from(transactions));
  type Account = NonNullable<typeof accs>[number];

  const today = todayISO();
  const [editingId, setEditingId] = useState<number | null>(null); // null cuando el sheet está cerrado
  const isEditing = editingId != null && editingId > 0;
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

  function openPay(card: Account) {
    setPayCard(card);
    setPayAmountText(String(cardDebt(card, txs ?? [])));
    setPayAccountId(null);
    setPayDate(today);
    setShowPayPicker(false);
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

  function onRemove(id: number, accName: string) {
    Alert.alert(`Eliminar "${accName}"`, 'Si tiene movimientos se archivará para conservar el historial.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          try {
            removeAccount(db, id);
          } catch (e) {
            Alert.alert('No se puede eliminar', e instanceof Error ? e.message : 'Error');
          }
        },
      },
    ]);
  }

  return (
    <View className="flex-1 bg-bg dark:bg-bg-dark" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 pb-1 pt-3.5">
        <Text className="text-xl font-bold text-ink dark:text-ink-dark">Cuentas</Text>
        <AddButton onPress={openCreate} />
      </View>

      <FlatList
        data={accs ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerClassName="gap-2.5 px-4 pb-28 pt-2.5"
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
      />

      {editingId != null ? (
        <KeyboardAvoidingView
          className="absolute inset-0 justify-end bg-black/45"
          behavior="padding"
        >
          <ScrollView
            className="max-h-full rounded-t-sheet bg-bg dark:bg-bg-dark"
            contentContainerClassName="px-4 pb-6 pt-[18px]"
            keyboardShouldPersistTaps="handled"
          >
            <View className="mb-3.5 h-1 w-9 self-center rounded-full bg-line dark:bg-line-dark" />
            <Text className="mb-3.5 text-base font-bold text-ink dark:text-ink-dark">{isEditing ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Nequi" />
            <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Tipo</Text>
            <View className="mb-2 flex-row flex-wrap" style={isEditing ? { opacity: 0.6 } : undefined}>
              {TIPOS.map((tp) => (
                <Chip key={tp.value} label={tp.label} selected={type === tp.value} onPress={isEditing ? () => {} : () => setType(tp.value)} />
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
                {!isEditing ? (
                  <Field label="Deuda actual (opcional)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />
                ) : null}
              </>
            ) : (
              <Field label="Saldo inicial (COP)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />
            )}
            {error ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
            <View className="mt-1 flex-row gap-2.5">
              <Button style={{ flex: 1 }} label="Cancelar" variant="ghost" onPress={() => setEditingId(null)} />
              <Button style={{ flex: 1 }} label={isEditing ? 'Guardar' : 'Crear'} onPress={onSubmit} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

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
    </View>
  );
}
