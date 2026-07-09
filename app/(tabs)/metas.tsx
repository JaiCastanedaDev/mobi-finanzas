import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { FlatList, Modal, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, savingsGoals, transactions } from '../../db/schema';
import { addToGoal, archiveGoal, createGoal } from '../../db/repos/goals';
import { goalProgress } from '../../lib/calc';
import { formatCOP, parseAmount } from '../../lib/money';
import { goalSchema } from '../../lib/validation';

export default function Metas() {
  const { data: goals } = useLiveQuery(db.select().from(savingsGoals).where(isNull(savingsGoals.archivedAt)));
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: txs } = useLiveQuery(db.select().from(transactions));

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetText, setTargetText] = useState('');
  const [linkedAccountId, setLinkedAccountId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [abonarGoalId, setAbonarGoalId] = useState<number | null>(null);
  const [abonoText, setAbonoText] = useState('');
  const [abonoError, setAbonoError] = useState('');

  function onCreate() {
    const parsed = goalSchema.safeParse({ name, targetAmount: parseAmount(targetText || '0'), accountId: linkedAccountId });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    createGoal(db, parsed.data);
    setCreateOpen(false);
    setName('');
    setTargetText('');
    setLinkedAccountId(null);
    setError('');
  }

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

  return (
    <View className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <FlatList
        data={goals ?? []}
        keyExtractor={(g) => String(g.id)}
        contentContainerClassName="pb-28"
        ListEmptyComponent={<Text className="mt-10 text-center text-neutral-500">Crea tu primera meta de ahorro 🎯</Text>}
        renderItem={({ item: g }) => {
          const progress = goalProgress(g, accs ?? [], txs ?? []);
          const pct = Math.min(100, Math.round((progress / g.targetAmount) * 100));
          const done = progress >= g.targetAmount;
          return (
            <View className="mb-3 rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <View className="flex-row items-center justify-between">
                <Text className="font-medium text-neutral-900 dark:text-white">{g.name}</Text>
                {done ? <Text className="font-semibold text-emerald-600">¡Cumplida! 🎉</Text> : <Text className="text-neutral-500">{pct}%</Text>}
              </View>
              <View className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <View className="h-2 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
              </View>
              <Text className="mt-1 text-xs text-neutral-500">
                {formatCOP(progress)} de {formatCOP(g.targetAmount)}
                {g.accountId != null ? ' · sigue el saldo de una cuenta' : ''}
              </Text>
              <View className="mt-2 flex-row">
                {g.accountId == null && !done ? <Button label="Abonar" variant="ghost" onPress={() => setAbonarGoalId(g.id)} /> : null}
                {done ? <Button label="Archivar" variant="ghost" onPress={() => archiveGoal(db, g.id)} /> : null}
              </View>
            </View>
          );
        }}
        ListFooterComponent={<Button label="+ Nueva meta" variant="ghost" onPress={() => setCreateOpen(true)} />}
      />

      <Modal visible={createOpen} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white p-6 dark:bg-neutral-900">
            <Text className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">Nueva meta</Text>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Viaje a San Andrés" />
            <Field label="Monto objetivo (COP)" value={targetText} onChangeText={setTargetText} keyboardType="numeric" />
            <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">Ligar a una cuenta (opcional)</Text>
            <View className="mb-3 flex-row flex-wrap">
              <Chip label="Manual" selected={linkedAccountId === null} onPress={() => setLinkedAccountId(null)} />
              {(accs ?? []).map((a) => (
                <Chip key={a.id} label={a.name} selected={linkedAccountId === a.id} onPress={() => setLinkedAccountId(a.id)} />
              ))}
            </View>
            {error ? <Text className="mb-2 text-red-500">{error}</Text> : null}
            <Button label="Crear" onPress={onCreate} />
            <View className="h-2" />
            <Button label="Cancelar" variant="ghost" onPress={() => setCreateOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={abonarGoalId != null} animationType="fade" transparent>
        <View className="flex-1 items-center justify-center bg-black/40 p-8">
          <View className="w-full rounded-2xl bg-white p-6 dark:bg-neutral-900">
            <Text className="mb-3 text-lg font-bold text-neutral-900 dark:text-white">Abonar a la meta</Text>
            <Field label="Monto (COP)" value={abonoText} onChangeText={setAbonoText} keyboardType="numeric" />
            {abonoError ? <Text className="mb-2 text-red-500">{abonoError}</Text> : null}
            <Button label="Abonar" onPress={onAbonar} />
            <View className="h-2" />
            <Button label="Cancelar" variant="ghost" onPress={() => setAbonarGoalId(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
