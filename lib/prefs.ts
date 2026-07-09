import Storage from 'expo-sqlite/kv-store';

export type Prefs = {
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  theme: 'system' | 'light' | 'dark';
};

const DEFAULTS: Prefs = { reminderEnabled: true, reminderHour: 21, reminderMinute: 0, theme: 'system' };

export function getPrefs(): Prefs {
  const raw = Storage.getItemSync('prefs');
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  Storage.setItemSync('prefs', JSON.stringify(next));
  return next;
}
