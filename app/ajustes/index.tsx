import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { useEffect, useState } from 'react';
import { Linking, ScrollView, Switch, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { db } from '../../db/client';
import { displayStreak, ensureAppState } from '../../db/repos/streak';
import { todayISO } from '../../lib/dates';
import { getNotificationPermissionStatus, rescheduleReminders, requestNotificationPermission } from '../../lib/notifications';
import { getPrefs, setPrefs, type Prefs } from '../../lib/prefs';

const HORAS = [7, 12, 18, 20, 21, 22];
const TEMAS = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const;

export default function Ajustes() {
  const [prefs, setPrefsState] = useState<Prefs>(getPrefs());
  const [permGranted, setPermGranted] = useState(true);
  const { setColorScheme } = useColorScheme();

  useEffect(() => {
    getNotificationPermissionStatus().then(setPermGranted);
  }, []);

  async function update(patch: Partial<Prefs>) {
    const next = setPrefs(patch);
    setPrefsState(next);
    if (patch.theme) setColorScheme(patch.theme);
    const state = ensureAppState(db);
    const today = todayISO();
    await rescheduleReminders({ loggedToday: state.lastLoggedDate === today, streak: displayStreak(state, today) }).catch(() => {});
  }

  return (
    <ScrollView className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <View className="mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900">
        <View className="flex-row items-center justify-between">
          <Text className="font-medium text-neutral-900 dark:text-white">Recordatorio diario</Text>
          <Switch value={prefs.reminderEnabled} onValueChange={(v) => update({ reminderEnabled: v })} />
        </View>
        {prefs.reminderEnabled ? (
          <View className="mt-3 flex-row flex-wrap">
            {HORAS.map((h) => (
              <Chip key={h} label={`${h}:00`} selected={prefs.reminderHour === h} onPress={() => update({ reminderHour: h })} />
            ))}
          </View>
        ) : null}
        {!permGranted ? (
          <View className="mt-3">
            <Text className="mb-2 text-sm text-amber-600">Las notificaciones están desactivadas para la app.</Text>
            <Button
              label="Activar notificaciones"
              variant="ghost"
              onPress={async () => {
                const ok = await requestNotificationPermission();
                setPermGranted(ok);
                if (!ok) Linking.openSettings();
              }}
            />
          </View>
        ) : null}
      </View>

      <View className="mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900">
        <Text className="mb-2 font-medium text-neutral-900 dark:text-white">Tema</Text>
        <View className="flex-row">
          {TEMAS.map((t) => (
            <Chip key={t.value} label={t.label} selected={prefs.theme === t.value} onPress={() => update({ theme: t.value })} />
          ))}
        </View>
      </View>

      <Button label="Gestionar categorías" variant="ghost" onPress={() => router.push('/ajustes/categorias')} />
    </ScrollView>
  );
}
