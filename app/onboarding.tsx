import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { Field } from '../components/ui/Field';
import { db } from '../db/client';
import { createAccount } from '../db/repos/accounts';
import { parseAmount } from '../lib/money';
import { rescheduleReminders, requestNotificationPermission } from '../lib/notifications';
import { setPrefs } from '../lib/prefs';
import { accountSchema } from '../lib/validation';

const TIPOS = [
  { value: 'debito', label: 'Débito' },
  { value: 'ahorro', label: 'Ahorro' },
  { value: 'efectivo', label: 'Efectivo' },
] as const;

const HORAS = [7, 12, 18, 20, 21, 22];

export default function Onboarding() {
  const [name, setName] = useState('');
  const [type, setType] = useState<'debito' | 'ahorro' | 'efectivo'>('debito');
  const [balanceText, setBalanceText] = useState('');
  const [hour, setHour] = useState(21);
  const [error, setError] = useState('');

  async function onStart() {
    const parsed = accountSchema.safeParse({ name, type, initialBalance: parseAmount(balanceText || '0') });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      createAccount(db, parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error creando la cuenta');
      return;
    }
    setPrefs({ reminderHour: hour, reminderMinute: 0 });
    router.replace('/(tabs)');
    requestNotificationPermission()
      .then((granted) => (granted ? rescheduleReminders({ loggedToday: false, streak: 0 }) : undefined))
      .catch(() => {});
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior="padding">
    <ScrollView
      className="flex-1 bg-bg p-6 dark:bg-bg-dark"
      contentContainerClassName="pb-12"
      keyboardShouldPersistTaps="handled"
    >
      <Text className="mb-1 mt-10 text-3xl font-bold text-ink dark:text-ink-dark">¡Hola! 👋</Text>
      <Text className="mb-6 text-sm text-sub dark:text-sub-dark">Crea tu primera cuenta para empezar a registrar.</Text>

      <Field label="Nombre de la cuenta" value={name} onChangeText={setName} placeholder="Ej: Bancolombia, Efectivo…" />
      <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">Tipo</Text>
      <View className="mb-3 flex-row flex-wrap">
        {TIPOS.map((t) => (
          <Chip key={t.value} label={t.label} selected={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </View>
      <Field label="Saldo actual (COP)" value={balanceText} onChangeText={setBalanceText} keyboardType="numeric" placeholder="0" />

      <Text className="mb-1.5 mt-4 text-[11px] font-medium text-sub dark:text-sub-dark">¿A qué hora te recordamos registrar?</Text>
      <View className="mb-6 flex-row flex-wrap">
        {HORAS.map((h) => (
          <Chip key={h} label={`${h}:00`} selected={hour === h} onPress={() => setHour(h)} />
        ))}
      </View>

      {error ? <Text className="mb-3 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
      <Button label="Empezar" onPress={onStart} />
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
