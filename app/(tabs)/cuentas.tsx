import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, transactions } from '../../db/schema';
import { createAccount, removeAccount } from '../../db/repos/accounts';
import { accountBalance } from '../../lib/calc';
import { formatCOP, parseAmount } from '../../lib/money';
import { accountSchema } from '../../lib/validation';

const TIPOS = [
  { value: 'debito', label: 'Débito' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
] as const;

export default function Cuentas() {
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: txs } = useLiveQuery(db.select().from(transactions));
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<'debito' | 'ahorro' | 'efectivo'>('debito');
  const [balanceText, setBalanceText] = useState('');
  const [error, setError] = useState('');

  function onCreate() {
    const parsed = accountSchema.safeParse({ name, type, initialBalance: parseAmount(balanceText || '0') });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      createAccount(db, parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      return;
    }
    setModalOpen(false);
    setName('');
    setBalanceText('');
    setError('');
  }

  function onRemove(id: number, accName: string) {
    Alert.alert(`Eliminar "${accName}"`, 'Si tiene movimientos se archivará para conservar el historial.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeAccount(db, id) },
    ]);
  }

  return (
    <View className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <FlatList
        data={accs ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerClassName="pb-28"
        renderItem={({ item: a }) => {
          const bal = accountBalance(a, txs ?? []);
          return (
            <Pressable onLongPress={() => onRemove(a.id, a.name)} className="mb-2 rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="font-medium text-neutral-900 dark:text-white">{a.name}</Text>
                  <Text className="text-xs capitalize text-neutral-500">{a.type}</Text>
                </View>
                <Text className={`text-lg font-semibold ${bal < 0 ? 'text-red-500' : 'text-neutral-900 dark:text-white'}`}>{formatCOP(bal)}</Text>
              </View>
            </Pressable>
          );
        }}
        ListFooterComponent={<Button label="+ Nueva cuenta" variant="ghost" onPress={() => setModalOpen(true)} />}
      />

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white p-6 dark:bg-neutral-900">
            <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Nueva cuenta</Text>
            <Field label="Nombre" value={name} onChangeText={setName} />
            <View className="mb-3 flex-row">
              {TIPOS.map((t) => (
                <Chip key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
              ))}
            </View>
            <Field label="Saldo inicial (COP)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />
            {error ? <Text className="mb-2 text-red-500">{error}</Text> : null}
            <Button label="Crear" onPress={onCreate} />
            <View className="h-2" />
            <Button label="Cancelar" variant="ghost" onPress={() => setModalOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
