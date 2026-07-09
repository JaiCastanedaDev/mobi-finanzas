import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <View className={`rounded-2xl bg-white p-4 dark:bg-neutral-900 ${className}`}>{children}</View>;
}
