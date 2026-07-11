import { Text, TextInput, View } from 'react-native';
import { useTheme } from '../../lib/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  error?: string;
};

export function Field({ label, value, onChangeText, placeholder, keyboardType = 'default', error }: Props) {
  const t = useTheme();
  return (
    <View className="mb-3">
      <Text className="mb-1.5 text-[11px] font-medium text-sub dark:text-sub-dark">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textSub}
        keyboardType={keyboardType}
        className="rounded-field border border-line bg-card px-[13px] py-3 text-[13px] font-medium text-ink dark:border-line-dark dark:bg-card-dark dark:text-ink-dark"
      />
      {error ? <Text className="mt-1 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
    </View>
  );
}
