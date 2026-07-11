import { desc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { ArrowLeftRight, X } from 'lucide-react-native';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MonthSelector } from '../../components/MonthSelector';
import { db } from '../../db/client';
import { accounts, categories, transactions, type Tx } from '../../db/schema';
import { dayLabel, todayISO } from '../../lib/dates';
import { formatCOP } from '../../lib/money';
import { useTheme } from '../../lib/theme';
import { useUI } from '../../store/ui';
import { icons } from '../../lib/iconMap';

export default function Movimientos() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const today = todayISO();
  const { selectedMonth, categoryFilter, setCategoryFilter } = useUI();
  const { data: txs } = useLiveQuery(db.select().from(transactions).orderBy(desc(transactions.date), desc(transactions.id)));
  const { data: cats } = useLiveQuery(db.select().from(categories));
  const { data: accs } = useLiveQuery(db.select().from(accounts));

  const filtered = (txs ?? []).filter(
    (tx) => tx.date.startsWith(selectedMonth) && (categoryFilter == null || tx.categoryId === categoryFilter),
  );
  const filterName = categoryFilter != null ? (cats ?? []).find((c) => c.id === categoryFilter)?.name : null;

  const groups: { day: string; items: Tx[] }[] = [];
  for (const tx of filtered) {
    const day = dayLabel(tx.date, today);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(tx);
    else groups.push({ day, items: [tx] });
  }

  const accName = (id: number | null) => (accs ?? []).find((a) => a.id === id)?.name ?? '';

  return (
    <View className="flex-1 bg-bg dark:bg-bg-dark" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-1 pt-3.5">
        <Text className="mb-2.5 text-xl font-bold text-ink dark:text-ink-dark">Movimientos</Text>
        <View className="flex-row items-center">
          <MonthSelector />
          {filterName ? (
            <Pressable
              onPress={() => setCategoryFilter(null)}
              className="ml-2 flex-row items-center rounded-full border border-line bg-card px-3 py-[7px] dark:border-line-dark dark:bg-card-dark"
            >
              <Text className="mr-1.5 text-[11.5px] font-semibold text-ink dark:text-ink-dark">{filterName}</Text>
              <X size={12} color={t.textSub} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={(g) => g.day}
        contentContainerClassName="gap-3 px-4 pb-28 pt-2.5"
        ListEmptyComponent={<Text className="mt-10 text-center text-[11.5px] text-sub dark:text-sub-dark">No hay movimientos con este filtro.</Text>}
        renderItem={({ item: grp }) => (
          <View>
            <Text className="mb-1.5 px-0.5 text-[11px] font-semibold text-sub dark:text-sub-dark">{grp.day}</Text>
            <View className="overflow-hidden rounded-row border border-line bg-card dark:border-line-dark dark:bg-card-dark">
              {grp.items.map((tx, i) => {
                const cat = (cats ?? []).find((c) => c.id === tx.categoryId);
                const isTransfer = tx.kind === 'transferencia';
                const Icon = isTransfer ? ArrowLeftRight : (icons[cat?.icon as keyof typeof icons] ?? icons.Circle);
                const color = isTransfer ? t.textSub : (cat?.color ?? t.textSub);
                const title = isTransfer ? 'Transferencia' : (tx.note || (cat?.name ?? 'Sin categoría'));
                const sub = isTransfer
                  ? `${accName(tx.accountId)} → ${accName(tx.toAccountId)}`
                  : [cat?.name ?? 'Sin categoría', accName(tx.accountId)].filter(Boolean).join(' · ');
                const amountColor = tx.kind === 'ingreso' ? t.pos : tx.kind === 'gasto' ? t.neg : t.textSub;
                const sign = tx.kind === 'ingreso' ? '+' : tx.kind === 'gasto' ? '-' : '';
                return (
                  <Pressable
                    key={tx.id}
                    onPress={() => router.push(`/movimiento/${tx.id}`)}
                    className={`flex-row items-center gap-[11px] px-[13px] py-[11px] ${
                      i < grp.items.length - 1 ? 'border-b border-line dark:border-line-dark' : ''
                    }`}
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-[11px]" style={{ backgroundColor: `${color}33` }}>
                      <Icon color={color} size={17} />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[13px] font-semibold text-ink dark:text-ink-dark" numberOfLines={1}>
                        {title}
                      </Text>
                      <Text className="text-[10.5px] font-medium text-sub dark:text-sub-dark" numberOfLines={1}>
                        {sub}
                      </Text>
                    </View>
                    <Text className="text-[13px] font-bold" style={{ color: amountColor }}>
                      {sign}{formatCOP(tx.amount)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      />
    </View>
  );
}
