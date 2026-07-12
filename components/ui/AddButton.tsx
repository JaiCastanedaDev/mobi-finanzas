import { Plus } from 'lucide-react-native';
import { Text } from 'react-native';
import Animated, { BounceIn } from 'react-native-reanimated';
import { useTheme } from '../../lib/theme';
import { AnimatedPressable } from './AnimatedPressable';

type Props = { label?: string; onPress: () => void };

/** Botón de acción primaria para cabeceras de pantalla (Cuentas, Metas): relleno, con ícono y sombra, para que no pase desapercibido. */
export function AddButton({ label = 'Nueva', onPress }: Props) {
  const t = useTheme();
  return (
    <Animated.View entering={BounceIn.delay(150).duration(500)}>
      <AnimatedPressable
        onPress={onPress}
        scaleTo={0.9}
        className="flex-row items-center gap-1 rounded-full bg-primary py-2 pl-2.5 pr-3.5 dark:bg-primary-dark"
        style={{
          shadowColor: t.primaryShadow,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 1,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        <Plus size={16} color={t.onPrimary} strokeWidth={2.75} />
        <Text className="text-[12.5px] font-bold text-onprimary dark:text-onprimary-dark">{label}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
}
