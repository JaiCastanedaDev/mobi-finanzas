import { Text, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../lib/theme';
import { AnimatedPressable } from './AnimatedPressable';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Estilos inline (no NativeWind): ver comentario en AnimatedPressable.tsx.
export function Button({ label, onPress, variant = 'primary', disabled, style }: Props) {
  const t = useTheme();
  const ghost = variant === 'ghost';
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? t.neg : t.card;
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          alignItems: 'center',
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: bg,
          borderWidth: ghost ? 1 : 0,
          borderColor: t.border,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: ghost ? t.textSub : t.onPrimary }}>{label}</Text>
    </AnimatedPressable>
  );
}
