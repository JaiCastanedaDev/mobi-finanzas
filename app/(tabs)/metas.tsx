import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddButton } from '../../components/ui/AddButton';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { accounts, savingsGoals, transactions } from '../../db/schema';
import { addToGoal, archiveGoal, createGoal, deleteGoal } from '../../db/repos/goals';
import { goalProgress } from '../../lib/calc';
import { formatCOP, parseAmount } from '../../lib/money';
import { useTheme } from '../../lib/theme';
import { goalSchema } from '../../lib/validation';

export default function Metas() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
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

  function onDelete(id: number, goalName: string) {
    Alert.alert(`Eliminar "${goalName}"`, 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteGoal(db, id) },
    ]);
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
    <View className="flex-1 bg-bg dark:bg-bg-dark" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-4 pb-1 pt-3.5">
        <Text className="text-xl font-bold text-ink dark:text-ink-dark">Metas</Text>
        <AddButton onPress={() => setCreateOpen(true)} />
      </View>

      <FlatList
        data={goals ?? []}
        keyExtractor={(g) => String(g.id)}
        contentContainerClassName="gap-3 px-4 pb-28 pt-2.5"
        ListEmptyComponent={<Text className="mt-10 text-center text-[11.5px] text-sub dark:text-sub-dark">Crea tu primera meta de ahorro 🎯</Text>}
        renderItem={({ item: g }) => {
          const progress = goalProgress(g, accs ?? [], txs ?? []);
          const pct = Math.min(100, Math.round((progress / g.targetAmount) * 100));
          const done = progress >= g.targetAmount;
          return (
            <View
              className="rounded-card bg-card p-4 dark:bg-card-dark"
              style={{ borderWidth: 1, borderColor: done ? t.pos : t.border }}
            >
              <View className="mb-2.5 flex-row items-start justify-between">
                <View className="min-w-0 flex-1 pr-2">
                  <Text className="text-sm font-semibold text-ink dark:text-ink-dark">{g.name}</Text>
                  <Text className="mt-0.5 text-[11px] font-medium text-sub dark:text-sub-dark">
                    {formatCOP(progress)} / {formatCOP(g.targetAmount)}
                    {g.accountId != null ? ' · ligada a una cuenta' : ''}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2.5">
                  {done ? (
                    <View className="rounded-full bg-posbg px-2.5 py-[5px] dark:bg-posbg-dark">
                      <Text className="text-[10.5px] font-semibold text-pos dark:text-pos-dark">Completada</Text>
                    </View>
                  ) : null}
                  <Pressable onPress={() => onDelete(g.id, g.name)} hitSlop={8}>
                    <Trash2 size={15} color={t.textSub} />
                  </Pressable>
                </View>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-line dark:bg-line-dark">
                <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: done ? t.pos : t.primary }} />
              </View>
              <View className="mt-2.5 flex-row items-center justify-between">
                <Text className="text-[11px] font-semibold text-sub dark:text-sub-dark">{pct}%</Text>
                {g.accountId == null && !done ? (
                  <Pressable
                    onPress={() => setAbonarGoalId(g.id)}
                    className="rounded-full bg-primary px-3.5 py-[7px] dark:bg-primary-dark"
                  >
                    <Text className="text-[11.5px] font-semibold text-onprimary dark:text-onprimary-dark">Abonar</Text>
                  </Pressable>
                ) : null}
                {done ? (
                  <Pressable
                    onPress={() => archiveGoal(db, g.id)}
                    className="rounded-full border border-line bg-card px-3.5 py-[7px] dark:border-line-dark dark:bg-card-dark"
                  >
                    <Text className="text-[11.5px] font-semibold text-sub dark:text-sub-dark">Archivar</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {createOpen ? (
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
            <Text className="mb-3.5 text-base font-bold text-ink dark:text-ink-dark">Nueva meta</Text>
            <Field label="Nombre" value={name} onChangeText={setName} placeholder="Ej: Viaje a San Andrés" />
            <Field label="Monto objetivo (COP)" value={targetText} onChangeText={setTargetText} keyboardType="numeric" />
            <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Ligar a una cuenta (opcional)</Text>
            <View className="mb-2 flex-row flex-wrap">
              <Chip label="Manual" selected={linkedAccountId === null} onPress={() => setLinkedAccountId(null)} />
              {(accs ?? []).map((a) => (
                <Chip key={a.id} label={a.name} selected={linkedAccountId === a.id} onPress={() => setLinkedAccountId(a.id)} />
              ))}
            </View>
            {error ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
            <View className="mt-1 flex-row gap-2.5">
              <Button className="flex-1" label="Cancelar" variant="ghost" onPress={() => setCreateOpen(false)} />
              <Button className="flex-1" label="Crear" onPress={onCreate} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      {abonarGoalId != null ? (
        <KeyboardAvoidingView
          className="absolute inset-0 items-center justify-center bg-black/45 p-8"
          behavior="padding"
        >
          <View className="w-full rounded-card border border-line bg-bg p-5 dark:border-line-dark dark:bg-bg-dark">
            <Text className="mb-3 text-base font-bold text-ink dark:text-ink-dark">Abonar a la meta</Text>
            <Field label="Monto (COP)" value={abonoText} onChangeText={setAbonoText} keyboardType="numeric" />
            {abonoError ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{abonoError}</Text> : null}
            <View className="mt-1 flex-row gap-2.5">
              <Button className="flex-1" label="Cancelar" variant="ghost" onPress={() => setAbonarGoalId(null)} />
              <Button className="flex-1" label="Abonar" onPress={onAbonar} />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </View>
  );
}
