import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { Flame, Settings } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-gifted-charts';
import Svg, { Polyline } from 'react-native-svg';
import { MonthSelector } from '../../components/MonthSelector';
import { Card } from '../../components/ui/Card';
import { db } from '../../db/client';
import { accounts, appState, categories, savingsGoals, transactions } from '../../db/schema';
import { displayStreak } from '../../db/repos/streak';
import { balanceByMonth, expensesByCategory, goalProgress, monthSummary } from '../../lib/calc';
import { lastNMonths, monthLabel, todayISO } from '../../lib/dates';
import { formatCOP } from '../../lib/money';
import { useTheme } from '../../lib/theme';
import { useUI } from '../../store/ui';

const CHART_W = 260;
const CHART_H = 52;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? CHART_W / (values.length - 1) : CHART_W;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(4 + (1 - (v - min) / span) * (CHART_H - 8)).toFixed(1)}`)
    .join(' ');
  return (
    <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function Dashboard() {
  const today = todayISO();
  const t = useTheme();
  const insets = useSafeAreaInsets();
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
  const monthsWithData = new Set(allTx.map((tx) => tx.date.slice(0, 7)));
  const streak = stateRows?.[0] ? displayStreak(stateRows[0], today) : 0;

  return (
    <ScrollView
      className="flex-1 bg-bg dark:bg-bg-dark"
      style={{ paddingTop: insets.top }}
      contentContainerClassName="px-4 pb-28"
    >
      {/* Header */}
      <View className="mb-3 mt-3 flex-row items-center justify-between">
        <View>
          <Text className="text-[15px] font-semibold text-ink dark:text-ink-dark">Hola 👋</Text>
          <MonthSelector className="mt-1.5" />
        </View>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center rounded-full bg-streakbg px-[11px] py-1.5 dark:bg-streakbg-dark">
            <Flame size={14} color={t.streakDot} fill={t.streakDot} />
            <Text className="ml-1 text-[13px] font-bold text-streaktext dark:text-streaktext-dark">
              {streak} {streak === 1 ? 'día' : 'días'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/ajustes')}
            className="h-8 w-8 items-center justify-center rounded-full border border-line bg-card dark:border-line-dark dark:bg-card-dark"
          >
            <Settings size={15} color={t.textSub} />
          </Pressable>
        </View>
      </View>

      {/* Balance del mes */}
      <Card className="mb-3.5">
        <Text className="mb-1 text-[11px] font-medium text-sub dark:text-sub-dark">Balance del mes</Text>
        <Text className="text-[28px] font-bold leading-8 text-ink dark:text-ink-dark">{formatCOP(summary.balance)}</Text>
        <View className="mt-3.5 flex-row gap-4 border-t border-line pt-3 dark:border-line-dark">
          <View className="flex-1">
            <Text className="text-[10px] font-medium text-sub dark:text-sub-dark">Ingresos</Text>
            <Text className="text-sm font-bold text-pos dark:text-pos-dark">+{formatCOP(summary.ingresos)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-[10px] font-medium text-sub dark:text-sub-dark">Gastos</Text>
            <Text className="text-sm font-bold text-neg dark:text-neg-dark">-{formatCOP(summary.gastos)}</Text>
          </View>
        </View>
      </Card>

      {/* Gastos por categoría */}
      <Card className="mb-3.5">
        <Text className="mb-3 text-xs font-semibold text-ink dark:text-ink-dark">Gastos por categoría</Text>
        {donut.length === 0 ? (
          <Text className="text-[11.5px] text-sub dark:text-sub-dark">Sin gastos este mes. ¡Registra el primero con el botón +!</Text>
        ) : (
          <View className="flex-row items-center gap-4">
            <PieChart
              data={donut.map((d) => ({ value: d.total, color: d.color }))}
              radius={38}
              strokeWidth={2}
              strokeColor={t.card}
            />
            <View className="flex-1 gap-[7px]">
              {donut.map((d) => (
                <Pressable
                  key={`${d.categoryId}`}
                  className="flex-row items-center justify-between"
                  onPress={() => {
                    if (d.categoryId != null) {
                      setCategoryFilter(d.categoryId);
                      router.push('/(tabs)/movimientos');
                    }
                  }}
                >
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: d.color }} />
                    <Text className="text-[11.5px] font-medium text-ink dark:text-ink-dark" numberOfLines={1}>
                      {d.name}
                    </Text>
                  </View>
                  <Text className="text-[11.5px] font-semibold text-ink dark:text-ink-dark">
                    {summary.gastos > 0 ? Math.round((d.total / summary.gastos) * 100) : 0}%
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Card>

      {/* Evolución del balance */}
      <Card className="mb-3.5">
        <Text className="mb-2.5 text-xs font-semibold text-ink dark:text-ink-dark">Evolución del balance</Text>
        {monthsWithData.size < 2 ? (
          <Text className="text-[11.5px] text-sub dark:text-sub-dark">Cuando tengas al menos 2 meses de datos verás tu evolución aquí.</Text>
        ) : (
          <>
            <Sparkline values={evolution.map((e) => e.balance)} color={t.primary} />
            <View className="mt-0.5 flex-row justify-between">
              {evolution.map((e) => (
                <Text key={e.month} className="text-[9.5px] font-medium capitalize text-sub dark:text-sub-dark">
                  {monthLabel(e.month).slice(0, 3)}
                </Text>
              ))}
            </View>
          </>
        )}
      </Card>

      {/* Tus metas */}
      {(goals ?? []).length > 0 ? (
        <>
          <Text className="mb-3 text-xs font-semibold text-ink dark:text-ink-dark">Tus metas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2.5 pr-4">
            {(goals ?? []).map((g) => {
              const progress = goalProgress(g, accs ?? [], allTx);
              const pct = Math.min(100, Math.round((progress / g.targetAmount) * 100));
              const done = progress >= g.targetAmount;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => router.push('/(tabs)/metas')}
                  className="w-40 rounded-row border border-line bg-card p-3 dark:border-line-dark dark:bg-card-dark"
                >
                  <Text className="text-[11.5px] font-semibold text-ink dark:text-ink-dark" numberOfLines={1}>
                    {g.name}
                  </Text>
                  <View className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line dark:bg-line-dark">
                    <View
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: done ? t.pos : t.primary }}
                    />
                  </View>
                  <Text className="mt-1.5 text-[10px] font-semibold text-sub dark:text-sub-dark">{pct}%</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}
