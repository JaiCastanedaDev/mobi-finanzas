import { Pressable, Text, View } from 'react-native';
import { onColor, useTheme } from '../../lib/theme';

type Props = { label: string; selected: boolean; onPress: () => void; color?: string };

export function Chip({ label, selected, onPress, color }: Props) {
  const t = useTheme();
  // Seleccionado: relleno con el color de acento (o primario); sin seleccionar: superficie de tarjeta.
  const accent = color ?? t.primary;
  return (
    <Pressable
      onPress={onPress}
      className="mb-2 mr-2 flex-row items-center rounded-full px-[13px] py-2"
      style={{
        backgroundColor: selected ? accent : t.card,
        borderWidth: 1,
        borderColor: selected ? accent : t.border,
      }}
    >
      {color && !selected ? <View className="mr-1.5 h-[7px] w-[7px] rounded-full" style={{ backgroundColor: color }} /> : null}
      <Text
        className="text-[11.5px] font-semibold"
        style={{ color: selected ? (color ? onColor(color) : t.onPrimary) : t.text }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
