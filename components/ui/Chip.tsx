import { Pressable, Text, View } from 'react-native';

type Props = { label: string; selected: boolean; onPress: () => void; color?: string };

export function Chip({ label, selected, onPress, color }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-2 mr-2 flex-row items-center rounded-full border px-3 py-2 ${
        selected ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950' : 'border-neutral-300 dark:border-neutral-700'
      }`}
    >
      {color ? <View className="mr-1.5 h-3 w-3 rounded-full" style={{ backgroundColor: color }} /> : null}
      <Text className={selected ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-300'}>{label}</Text>
    </Pressable>
  );
}
