import '../global.css';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack, router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import migrations from '../drizzle/migrations';
import { db } from '../db/client';
import { seedIfEmpty } from '../db/repos/categories';
import { displayStreak, ensureAppState } from '../db/repos/streak';
import { todayISO } from '../lib/dates';
import { rescheduleReminders, useLastNotificationResponse } from '../lib/notifications';
import { getPrefs } from '../lib/prefs';
import { useTheme } from '../lib/theme';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  const { setColorScheme } = useColorScheme();
  const t = useTheme();
  const lastNotificationResponse = useLastNotificationResponse();

  useEffect(() => {
    if (!success) return;
    setColorScheme(getPrefs().theme);
    seedIfEmpty(db);
    const state = ensureAppState(db);
    const today = todayISO();
    rescheduleReminders({ loggedToday: state.lastLoggedDate === today, streak: displayStreak(state, today) }).catch(() => {});
  }, [success]);

  useEffect(() => {
    if (success && lastNotificationResponse) {
      router.push('/movimiento/nuevo');
    }
  }, [success, lastNotificationResponse]);

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-bg p-6 dark:bg-bg-dark">
        <Text className="text-center text-neg dark:text-neg-dark">Error preparando la base de datos: {error.message}</Text>
      </View>
    );
  }
  if (!success) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { color: t.text, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="movimiento/nuevo" options={{ presentation: 'modal', headerShown: false }} />
      <Stack.Screen name="movimiento/[id]" options={{ title: 'Movimiento' }} />
      <Stack.Screen name="ajustes/index" options={{ title: 'Ajustes' }} />
      <Stack.Screen name="ajustes/categorias" options={{ title: 'Categorías' }} />
    </Stack>
  );
}
