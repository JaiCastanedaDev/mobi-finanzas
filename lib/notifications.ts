import * as Notifications from 'expo-notifications';
import { getPrefs } from './prefs';
import { computeReminderDates } from './reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

export async function rescheduleReminders(opts: { loggedToday: boolean; streak: number }): Promise<void> {
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
