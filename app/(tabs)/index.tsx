import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { Flame, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LineChart, PieChart } from 'react-native-gifted-charts';
import { MonthSelector } from '../../components/MonthSelector';
import { Card } from '../../components/ui/Card';
import { db } from '../../db/client';
import { accounts, appState, categories, savingsGoals, transactions } from '../../db/schema';
import { displayStreak } from '../../db/repos/streak';
import { balanceByMonth, expensesByCategory, goalProgress, monthSummary } from '../../lib/calc';
import { lastNMonths, monthLabel, todayISO } from '../../lib/dates';
import { formatCOP } from '../../lib/money';
import { useUI } from '../../store/ui';

export default function Dashboard() {
  const today = todayISO();
  const { selectedMonth, setCategoryFilter } = useUI();
  const { data: txs } = useLiveQuery(db.select().from(transactions));
  const { data: cats } = useLiveQuery(db.select().from(categories));
  const { data: accs } = useLiveQuery(db.select().from(accounts).where(isNull(accounts.archivedAt)));
  const { data: goals } = useLiveQuery(db.select().from(savingsGoals).where(isNull(savingsGoals.archivedAt)));
  const { data: stateRows } = useLiveQuery(db.select().from(appState));

  const allTx = txs ?? [];
  const summary = monthSummary(allTx, selectedMonth);
  const donut = expensesByCategory(allTx, cats ?? [], selectedMonth);
  const months = lastNMonths(6, today);
  const evolution = balanceByMonth(allTx, months);
  const monthsWithData = new Set(allTx.map((t) => t.date.slice(0, 7)));
  const streak = stateRows?.[0] ? displayStreak(stateRows[0], today) : 0;

  return (
    <ScrollView className="flex-1 bg-neutral-100 dark:bg-neutral-950" contentContainerClassName="p-4 pb-28">
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Flame size={22} color="#f97316" />
          <Text className="ml-1 text-lg font-bold text-neutral-900 dark:text-white">
            {streak} {streak === 1 ? 'día' : 'días'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/ajustes')} className="p-2">
          <Settings size={22} color="#737373" />
        </Pressable>
      </View>

      <MonthSelector />

      <Card className="mb-4">
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">Balance del mes</Text>
        <Text className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCOP(summary.balance)}</Text>
        <View className="mt-2 flex-row justify-between">
          <Text className="text-emerald-600">↑ {formatCOP(summary.ingresos)}</Text>
          <Text className="text-red-500">↓ {formatCOP(summary.gastos)}</Text>
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-semibold text-neutral-900 dark:text-white">Gastos por categoría</Text>
        {donut.length === 0 ? (
          <Text className="text-neutral-500">Sin gastos este mes. ¡Registra el primero con el botón +!</Text>
        ) : (
          <View className="flex-row items-center">
            <PieChart
              data={donut.map((d) => ({ value: d.total, color: d.color }))}
              donut
              radius={70}
              innerRadius={45}
              centerLabelComponent={() => <Text className="text-xs text-neutral-500">{formatCOP(summary.gastos)}</Text>}
            />
            <View className="ml-4 flex-1">
              {donut.map((d) => (
                <Pressable
                  key={`${d.categoryId}`}
                  className="mb-1 flex-row items-center"
                  onPress={() => {
                    if (d.categoryId != null) {
                      setCategoryFilter(d.categoryId);
                      router.push('/(tabs)/movimientos');
                    }
                  }}
                >
                  <View className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                  <Text className="flex-1 text-xs text-neutral-700 dark:text-neutral-300" numberOfLines={1}>{d.name}</Text>
                  <Text className="text-xs text-neutral-500">{formatCOP(d.total)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 font-semibold text-neutral-900 dark:text-white">Evolución (6 meses)</Text>
        {monthsWithData.size < 2 ? (
          <Text className="text-neutral-500">Cuando tengas al menos 2 meses de datos verás tu evolución aquí.</Text>
        ) : (
          <LineChart
            data={evolution.map((e) => ({ value: e.balance, label: monthLabel(e.month).slice(0, 3) }))}
            height={140}
            color="#059669"
            thickness={2}
            hideDataPoints={false}
            dataPointsColor="#059669"
            yAxisTextStyle={{ color: '#737373', fontSize: 10 }}
            xAxisLabelTextStyle={{ color: '#737373', fontSize: 10 }}
            noOfSections={4}
            areaChart
            startFillColor="#05966922"
            endFillColor="#05966900"
          />
        )}
      </Card>

      {(goals ?? []).length > 0 ? (
        <Card>
          <Text className="mb-2 font-semibold text-neutral-900 dark:text-white">Metas</Text>
          {(goals ?? []).map((g) => {
            const progress = goalProgress(g, accs ?? [], allTx);
            const pct = Math.min(100, Math.round((progress / g.targetAmount) * 100));
            return (
              <View key={g.id} className="mb-3">
                <View className="flex-row justify-between">
                  <Text className="text-sm text-neutral-700 dark:text-neutral-300">{g.name}</Text>
                  <Text className="text-sm text-neutral-500">{pct}%</Text>
                </View>
                <View className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                  <View className="h-2 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}
    </ScrollView>
  );
}
