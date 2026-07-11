import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return (
    <View className={`rounded-card border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark ${className}`}>
      {children}
    </View>
  );
}
