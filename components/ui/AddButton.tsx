import { Plus } from 'lucide-react-native';
import { Text } from 'react-native';
import { useTheme } from '../../lib/theme';
import { AnimatedPressable } from './AnimatedPressable';

type Props = { label?: string; onPress: () => void };

/**
 * Botón de acción primaria para cabeceras de pantalla (Cuentas, Metas): relleno, con
 * ícono y sombra, para que no pase desapercibido. Estilos inline (no NativeWind) y sin
 * animación de entrada: el BounceIn podía dejar el botón en escala 0 si la animación
 * no corría, y la preferencia es animación mínima (solo feedback al presionar).
 */
export function AddButton({ label = 'Nueva', onPress }: Props) {
  const t = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      scaleTo={0.9}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 999,
        backgroundColor: t.primary,
        paddingVertical: 8,
        paddingLeft: 10,
        paddingRight: 14,
        shadowColor: t.primaryShadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 1,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <Plus size={16} color={t.onPrimary} strokeWidth={2.75} />
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: t.onPrimary }}>{label}</Text>
    </AnimatedPressable>
  );
}
