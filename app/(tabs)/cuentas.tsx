import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, transactions } from '../../db/schema';
import { createAccount, removeAccount } from '../../db/repos/accounts';
import { accountBalance } from '../../lib/calc';
import { formatCOP, parseAmount } from '../../lib/money';
import { useTheme } from '../../lib/theme';
import { accountSchema } from '../../lib/validation';

const TIPOS = [
  { value: 'debito', label: 'Débito' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
] as const;

export default function Cuentas() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
        <Pressable onPress={() => setModalOpen(true)} className="rounded-full bg-streakbg2 px-3 py-[7px] dark:bg-streakbg2-dark">
          <Text className="text-xs font-semibold text-primary dark:text-primary-dark">+ Nueva</Text>
        </Pressable>
      </View>

      <FlatList
        data={accs ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerClassName="gap-2.5 px-4 pb-28 pt-2.5"
        renderItem={({ item: a }) => {
          const bal = accountBalance(a, txs ?? []);
          return (
            <Pressable
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

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/45">
          <View className="rounded-t-sheet bg-bg px-4 pb-6 pt-[18px] dark:bg-bg-dark">
            <View className="mb-3.5 h-1 w-9 self-center rounded-full bg-line dark:bg-line-dark" />
            <Text className="mb-3.5 text-base font-bold text-ink dark:text-ink-dark">Nueva cuenta</Text>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej. Nequi" />
            <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Tipo</Text>
            <View className="mb-2 flex-row">
              {TIPOS.map((tp) => (
                <Chip key={tp.value} label={tp.label} selected={type === tp.value} onPress={() => setType(tp.value)} />
              ))}
            </View>
            <Field label="Saldo inicial (COP)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />
            {error ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
            <View className="mt-1 flex-row gap-2.5">
              <Button className="flex-1" label="Cancelar" variant="ghost" onPress={() => setModalOpen(false)} />
              <Button className="flex-1" label="Crear" onPress={onCreate} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
