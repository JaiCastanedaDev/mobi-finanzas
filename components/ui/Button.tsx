import { Pressable, Text } from 'react-native';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean };

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const bg = variant === 'primary' ? 'bg-emerald-600' : variant === 'danger' ? 'bg-red-600' : 'bg-transparent';
  const txt = variant === 'ghost' ? 'text-emerald-700 dark:text-emerald-400' : 'text-white';
  return (
    <Pressable onPress={onPress} disabled={disabled} className={`items-center rounded-xl px-4 py-3 ${bg} ${disabled ? 'opacity-40' : ''}`}>
      <Text className={`font-semibold ${txt}`}>{label}</Text>
    </Pressable>
  );
}
