import { Text } from 'react-native';
import { AnimatedPressable } from './AnimatedPressable';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string };

export function Button({ label, onPress, variant = 'primary', disabled, className = '' }: Props) {
  const bg =
    variant === 'primary'
      ? 'bg-primary dark:bg-primary-dark'
      : variant === 'danger'
        ? 'bg-neg dark:bg-neg-dark'
        : 'border border-line bg-card dark:border-line-dark dark:bg-card-dark';
  const txt = variant === 'ghost' ? 'text-sub dark:text-sub-dark' : 'text-onprimary dark:text-onprimary-dark';
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      className={`items-center rounded-btn px-4 py-3.5 ${bg} ${disabled ? 'opacity-40' : ''} ${className}`}
    >
      <Text className={`text-[13px] font-semibold ${txt}`}>{label}</Text>
    </AnimatedPressable>
  );
}
