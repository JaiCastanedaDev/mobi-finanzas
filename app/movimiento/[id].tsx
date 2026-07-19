import DateTimePicker from '@react-native-community/datetimepicker';
import { eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { CategoryGrid } from '../../components/CategoryGrid';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, transactions } from '../../db/schema';
import { deleteTransaction, updateTransaction } from '../../db/repos/transactions';
import { todayISO } from '../../lib/dates';
import { parseAmount } from '../../lib/money';
import { makeTransactionSchema } from '../../lib/validation';

export default function DetalleMovimiento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const txId = Number(id);
  const today = todayISO();
  const { data: rows } = useLiveQuery(db.select().from(transactions).where(eq(transactions.id, txId)), [txId]);
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const tx = rows?.[0];

  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (tx && !loaded) {
      setAmountText(String(tx.amount));
      setDate(tx.date);
      setAccountId(tx.accountId);
      setToAccountId(tx.toAccountId);
      setCategoryId(tx.categoryId);
      setNote(tx.note ?? '');
      setLoaded(true);
    }
  }, [tx, loaded]);

  if (!tx) return null;

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

  function onDelete() {
    Alert.alert('Borrar movimiento', '¿Seguro? Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: () => {
          deleteTransaction(db, txId);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
    <ScrollView
      className="flex-1 bg-bg p-4 dark:bg-bg-dark"
      contentContainerClassName="pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="mb-3 text-center text-xs font-medium text-sub dark:text-sub-dark">
        {tx.kind === 'gasto' ? 'Gasto' : tx.kind === 'ingreso' ? 'Ingreso' : 'Transferencia'} · el tipo no se puede cambiar
      </Text>
      <Field label="Monto (COP)" value={amountText} onChangeText={setAmountText} keyboardType="numeric" />

      <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Fecha</Text>
      <Chip label={`📅 ${date}`} selected onPress={() => setShowPicker(true)} />
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

      <Text className="mb-1.5 mt-3 text-[11px] font-medium text-sub dark:text-sub-dark">{tx.kind === 'ingreso' ? 'Cuenta destino' : 'Cuenta origen'}</Text>
      <View className="mb-3 flex-row flex-wrap">
        {(accs ?? []).map((a) => (
          <Chip key={a.id} label={a.name} selected={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </View>

      {tx.kind === 'transferencia' ? (
        <>
          <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Cuenta destino</Text>
          <View className="mb-3 flex-row flex-wrap">
            {(accs ?? []).map((a) => (
              <Chip key={a.id} label={a.name} selected={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />
            ))}
          </View>
        </>
      ) : (
        <>
          <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Categoría</Text>
          <CategoryGrid kind={tx.kind as 'gasto' | 'ingreso'} selectedId={categoryId} onSelect={setCategoryId} />
        </>
      )}

      <Field label="Nota (opcional)" value={note} onChangeText={setNote} />
      {error ? <Text className="mb-3 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
      <Button label="Guardar cambios" loading={saving} onPress={onSave} />
      <View className="h-3" />
      <Button label="Borrar movimiento" variant="danger" onPress={onDelete} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
