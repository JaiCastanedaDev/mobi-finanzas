import { cssInterop } from 'nativewind';
import { forwardRef } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);
// NativeWind sólo resuelve `className` en los componentes que registra (View/Pressable/Text de RN);
// los componentes animados de Reanimated no vienen registrados, hay que hacerlo manualmente.
cssInterop(AnimatedPressableBase, { className: 'style' });

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/** Pressable con feedback táctil (scale spring) para que toda la app se sienta consistente. */
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
