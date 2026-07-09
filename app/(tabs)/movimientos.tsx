import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { desc } from 'drizzle-orm';
import { router } from 'expo-router';
import { ArrowLeftRight, X } from 'lucide-react-native';
import { FlatList, Pressable, Text, View } from 'react-native';
import { MonthSelector } from '../../components/MonthSelector';
import { db } from '../../db/client';
import { categories, transactions } from '../../db/schema';
import { formatCOP } from '../../lib/money';
import { useUI } from '../../store/ui';
import { icons } from '../../lib/iconMap';

export default function Movimientos() {
  const { selectedMonth, categoryFilter, setCategoryFilter } = useUI();
  const { data: txs } = useLiveQuery(db.select().from(transactions).orderBy(desc(transactions.date), desc(transactions.id)));
  const { data: cats } = useLiveQuery(db.select().from(categories));

  const filtered = (txs ?? []).filter(
    (t) => t.date.startsWith(selectedMonth) && (categoryFilter == null || t.categoryId === categoryFilter),
  );
  const filterName = categoryFilter != null ? (cats ?? []).find((c) => c.id === categoryFilter)?.name : null;

  return (
    <View className="flex-1 bg-neutral-100 dark:bg-neutral-950">
      <MonthSelector />
      {filterName ? (
        <Pressable
          onPress={() => setCategoryFilter(null)}
          className="mx-4 mb-2 flex-row items-center self-start rounded-full bg-emerald-100 px-3 py-1 dark:bg-emerald-950"
        >
          <Text className="mr-1 text-sm text-emerald-700 dark:text-emerald-400">{filterName}</Text>
          <X size={14} color="#059669" />
        </Pressable>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(t) => String(t.id)}
        contentContainerClassName="px-4 pb-28"
        ListEmptyComponent={<Text className="mt-10 text-center text-neutral-500">No hay movimientos con este filtro.</Text>}
        renderItem={({ item: t }) => {
          const cat = (cats ?? []).find((c) => c.id === t.categoryId);
          const Icon = t.kind === 'transferencia' ? ArrowLeftRight : (icons[cat?.icon as keyof typeof icons] ?? icons.Circle);
          const color = t.kind === 'transferencia' ? '#737373' : (cat?.color ?? '#737373');
          const amountColor = t.kind === 'ingreso' ? 'text-emerald-600' : t.kind === 'gasto' ? 'text-red-500' : 'text-neutral-500';
          const sign = t.kind === 'ingreso' ? '+' : t.kind === 'gasto' ? '-' : '';
          return (
            <Pressable
              onPress={() => router.push(`/movimiento/${t.id}`)}
              className="mb-2 flex-row items-center rounded-2xl bg-white p-3 dark:bg-neutral-900"
            >
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: `${color}33` }}>
                <Icon color={color} size={18} />
              </View>
              <View className="flex-1">
                <Text className="font-medium text-neutral-900 dark:text-white">
                  {t.kind === 'transferencia' ? 'Transferencia' : (cat?.name ?? 'Sin categoría')}
                </Text>
                <Text className="text-xs text-neutral-500">
                  {t.date}
                  {t.note ? ` · ${t.note}` : ''}
                </Text>
              </View>
              <Text className={`font-semibold ${amountColor}`}>{sign}{formatCOP(t.amount)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
