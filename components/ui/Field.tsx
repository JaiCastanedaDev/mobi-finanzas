import { Text, TextInput, View } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  error?: string;
};

export function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', error }: Props) {
  return (
    <View className="mb-3">
      <Text className="mb-1 text-sm text-neutral-500 dark:text-neutral-400">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        className="rounded-xl border border-neutral-300 px-3 py-3 text-base text-neutral-900 dark:border-neutral-700 dark:text-white"
      />
      {error ? <Text className="mt-1 text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
