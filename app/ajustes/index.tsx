import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { db } from '../../db/client';
import { categories } from '../../db/schema';
import { displayStreak, ensureAppState } from '../../db/repos/streak';
import { todayISO } from '../../lib/dates';
import { getNotificationPermissionStatus, rescheduleReminders, requestNotificationPermission } from '../../lib/notifications';
import { getPrefs, setPrefs, type Prefs } from '../../lib/prefs';
import { useTheme } from '../../lib/theme';

const HORAS = [7, 12, 18, 20, 21, 22];
const TEMAS = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
] as const;

export default function Ajustes() {
  const t = useTheme();
  const [prefs, setPrefsState] = useState<Prefs>(getPrefs());
  const [permGranted, setPermGranted] = useState(true);
  const { setColorScheme } = useColorScheme();
  const { data: cats } = useLiveQuery(db.select().from(categories).where(isNull(categories.archivedAt)));

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
    <ScrollView className="flex-1 bg-bg dark:bg-bg-dark" contentContainerClassName="gap-3 p-4 pb-12">
      <View className="rounded-btn border border-line bg-card p-1 dark:border-line-dark dark:bg-card-dark">
        <View className="flex-row items-center justify-between p-3">
          <Text className="text-[13px] font-medium text-ink dark:text-ink-dark">Recordatorio diario</Text>
          <Switch
            value={prefs.reminderEnabled}
            onValueChange={(v) => update({ reminderEnabled: v })}
            trackColor={{ false: t.border, true: t.primary }}
            thumbColor="#ffffff"
          />
        </View>
        {prefs.reminderEnabled ? (
          <View className="flex-row flex-wrap px-3 pb-2">
            {HORAS.map((h) => (
              <Chip key={h} label={`${h}:00`} selected={prefs.reminderHour === h} onPress={() => update({ reminderHour: h })} />
            ))}
          </View>
        ) : null}
        {!permGranted ? (
          <View className="px-3 pb-3">
            <Text className="mb-2 text-xs font-medium" style={{ color: t.streakDot }}>
              Las notificaciones están desactivadas para la app.
            </Text>
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

      <View className="rounded-btn border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark">
        <Text className="mb-2.5 text-[13px] font-medium text-ink dark:text-ink-dark">Tema</Text>
        <View className="flex-row">
          {TEMAS.map((tm) => (
            <Chip key={tm.value} label={tm.label} selected={prefs.theme === tm.value} onPress={() => update({ theme: tm.value })} />
          ))}
        </View>
      </View>

      <View>
        <Text className="mb-2 mt-1 text-[11px] font-medium text-sub dark:text-sub-dark">Categorías</Text>
        <View className="flex-row flex-wrap">
          {(cats ?? []).map((c) => (
            <View
              key={c.id}
              className="mb-2 mr-2 flex-row items-center rounded-full border border-line bg-card px-[13px] py-2 dark:border-line-dark dark:bg-card-dark"
            >
              <View className="mr-1.5 h-[7px] w-[7px] rounded-full" style={{ backgroundColor: c.color }} />
              <Text className="text-[11.5px] font-semibold text-ink dark:text-ink-dark">{c.name}</Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => router.push('/ajustes/categorias')}
          className="mt-1 flex-row items-center justify-between rounded-btn border border-line bg-card px-4 py-3.5 dark:border-line-dark dark:bg-card-dark"
        >
          <Text className="text-[13px] font-medium text-ink dark:text-ink-dark">Gestionar categorías</Text>
          <ChevronRight size={16} color={t.textSub} />
        </Pressable>
      </View>
    </ScrollView>
  );
}
