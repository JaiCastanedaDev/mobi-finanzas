import { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/**
 * Pressable con feedback táctil (scale spring) para que toda la app se sienta consistente.
 * Se estiliza SOLO por `style`: el registro cssInterop de NativeWind sobre componentes
 * animados no aplica las clases en el APK (los botones salían sin fondo ni padding),
 * así que `className` no está soportado aquí a propósito.
 */
export const AnimatedPressable = forwardRef<React.ComponentRef<typeof Pressable>, Props>(
  ({ style, scaleTo = 0.94, onPressIn, onPressOut, ...props }, ref) => {
    const scale = useSharedValue(1);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

    return (
      <AnimatedPressableBase
        ref={ref}
        style={[style, animatedStyle]}
        onPressIn={(e) => {
          scale.value = withSpring(scaleTo, { damping: 14, stiffness: 300 });
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          scale.value = withSpring(1, { damping: 10, stiffness: 200 });
          onPressOut?.(e);
        }}
        {...props}
      />
    );
  },
);
AnimatedPressable.displayName = 'AnimatedPressable';
