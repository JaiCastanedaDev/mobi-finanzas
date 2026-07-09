import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Redirect, Tabs, router } from 'expo-router';
import { ChartPie, List, PiggyBank, Plus, Wallet } from 'lucide-react-native';
import { Pressable } from 'react-native';
import { db } from '../../db/client';
import { accounts } from '../../db/schema';

export default function TabsLayout() {
  const { data: accs, updatedAt } = useLiveQuery(db.select({ id: accounts.id }).from(accounts));

  if (!updatedAt) return null;
  if (accs.length === 0) return <Redirect href="/onboarding" />;

  return (
    <>
      <Tabs screenOptions={{ tabBarActiveTintColor: '#059669' }}>
        <Tabs.Screen name="index" options={{ title: 'Inicio', tabBarIcon: ({ color, size }) => <ChartPie color={color} size={size} /> }} />
        <Tabs.Screen name="movimientos" options={{ title: 'Movimientos', tabBarIcon: ({ color, size }) => <List color={color} size={size} /> }} />
        <Tabs.Screen name="cuentas" options={{ title: 'Cuentas', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }} />
        <Tabs.Screen name="metas" options={{ title: 'Metas', tabBarIcon: ({ color, size }) => <PiggyBank color={color} size={size} /> }} />
      </Tabs>
      <Pressable
        onPress={() => router.push('/movimiento/nuevo')}
        className="absolute bottom-24 right-5 h-14 w-14 items-center justify-center rounded-full bg-emerald-600 shadow-lg"
      >
        <Plus color="white" size={28} />
      </Pressable>
    </>
  );
}
