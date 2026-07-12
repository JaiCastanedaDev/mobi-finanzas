import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Redirect, Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { ChartPie, List, PiggyBank, Plus, Wallet } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../../components/ui/AnimatedPressable';
import { db } from '../../db/client';
import { accounts } from '../../db/schema';
import { useTheme } from '../../lib/theme';

const TAB_META = {
  index: { label: 'Inicio', Icon: ChartPie },
  movimientos: { label: 'Movimientos', Icon: List },
  cuentas: { label: 'Cuentas', Icon: Wallet },
  metas: { label: 'Metas', Icon: PiggyBank },
} as const;

function MfTabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  const renderTab = (name: keyof typeof TAB_META) => {
    const routeIndex = state.routes.findIndex((r) => r.name === name);
    const route = state.routes[routeIndex];
    if (!route) return null;
    const focused = state.index === routeIndex;
    const { label, Icon } = TAB_META[name];
    return (
      <Pressable
        key={route.key}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
        }}
        className="flex-1 items-center rounded-xl px-2 py-1"
      >
        <Icon size={20} color={focused ? t.primary : t.tabInactive} />
        <Text className="mt-[3px] text-[9px] font-semibold" style={{ color: focused ? t.text : t.tabInactive }}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      className="flex-row items-center px-4 pt-2"
      style={{ backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 10) }}
    >
      {renderTab('index')}
      {renderTab('movimientos')}
      <AnimatedPressable
        onPress={() => router.push('/movimiento/nuevo')}
        scaleTo={0.88}
        className="mx-2 -mt-[18px] h-11 w-11 items-center justify-center rounded-full"
        style={{
          backgroundColor: t.primary,
          shadowColor: t.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 14,
          elevation: 6,
        }}
      >
        <Plus color={t.onPrimary} size={24} />
      </AnimatedPressable>
      {renderTab('cuentas')}
      {renderTab('metas')}
    </View>
  );
}

export default function TabsLayout() {
  const { data: accs, updatedAt } = useLiveQuery(db.select({ id: accounts.id }).from(accounts));

  if (!updatedAt) return null;
  if (accs.length === 0) return <Redirect href="/onboarding" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <MfTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="movimientos" />
      <Tabs.Screen name="cuentas" />
      <Tabs.Screen name="metas" />
    </Tabs>
  );
}
