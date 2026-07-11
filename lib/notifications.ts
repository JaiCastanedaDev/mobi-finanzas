import { isRunningInExpoGo } from 'expo';
import type * as ExpoNotifications from 'expo-notifications';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { getPrefs } from './prefs';
import { computeReminderDates } from './reminders';

// expo-notifications throws on import on Android inside Expo Go (SDK 53+ removed it there
// entirely, not just push tokens). Guard every entry point and load it dynamically so the
// module is never evaluated in that environment.
function isExpoGoAndroid(): boolean {
  return Platform.OS === 'android' && isRunningInExpoGo();
}

let notificationsModule: typeof ExpoNotifications | null = null;
let handlerReady = false;

async function loadNotifications(): Promise<typeof ExpoNotifications | null> {
  if (isExpoGoAndroid()) return null;
  if (!notificationsModule) {
    notificationsModule = await import('expo-notifications');
  }
  if (!handlerReady) {
    handlerReady = true;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }
  return notificationsModule;
}

export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  const Notifications = await loadNotifications();
  if (!Notifications) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function rescheduleReminders(opts: { loggedToday: boolean; streak: number }): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const prefs = getPrefs();
  if (!prefs.reminderEnabled) return;
  const dates = computeReminderDates({
    now: new Date(),
    hour: prefs.reminderHour,
    minute: prefs.reminderMinute,
    loggedToday: opts.loggedToday,
  });
  const body =
    opts.streak > 0 ? `🔥 Llevas ${opts.streak} ${opts.streak === 1 ? 'día' : 'días'}. ¡No rompas la racha!` : 'Registra tus movimientos y arranca tu racha.';
  for (const date of dates) {
    await Notifications.scheduleNotificationAsync({
      content: { title: '¿Registraste tus gastos de hoy?', body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

export function useLastNotificationResponse(): ExpoNotifications.NotificationResponse | null | undefined {
  const [response, setResponse] = useState<ExpoNotifications.NotificationResponse | null | undefined>(undefined);

  useEffect(() => {
    let responseSub: { remove: () => void } | undefined;
    let clearSub: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const Notifications = await loadNotifications();
      if (!Notifications || cancelled) return;
      const last = await Notifications.getLastNotificationResponseAsync();
      if (cancelled) return;
      setResponse(last);
      responseSub = Notifications.addNotificationResponseReceivedListener((next) => setResponse(next));
      clearSub = Notifications.addNotificationResponseClearedListener(() => setResponse(null));
    })();

    return () => {
      cancelled = true;
      responseSub?.remove();
      clearSub?.remove();
    };
  }, []);

  return response;
}
