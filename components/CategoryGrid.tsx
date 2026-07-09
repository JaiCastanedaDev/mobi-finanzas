import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Pressable, Text, View } from 'react-native';
import { icons } from '../lib/iconMap';
import { db } from '../db/client';
import { categories } from '../db/schema';

type Props = { kind: 'gasto' | 'ingreso'; selectedId: number | null; onSelect: (id: number) => void };

export function CategoryGrid({ kind, selectedId, onSelect }: Props) {
  const { data } = useLiveQuery(
    db.select().from(categories).where(and(eq(categories.kind, kind), isNull(categories.archivedAt))),
    [kind],
  );

  return (
    <View className="flex-row flex-wrap">
      {(data ?? []).map((cat) => {
        const Icon = icons[cat.icon as keyof typeof icons] ?? icons.Circle;
        const selected = selectedId === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            className={`mb-3 w-1/4 items-center ${selected ? 'opacity-100' : 'opacity-60'}`}
          >
            <View
              className={`h-12 w-12 items-center justify-center rounded-full ${selected ? 'border-2 border-emerald-600' : ''}`}
              style={{ backgroundColor: `${cat.color}33` }}
            >
              <Icon color={cat.color} size={22} />
            </View>
            <Text className="mt-1 text-center text-xs text-neutral-700 dark:text-neutral-300" numberOfLines={1}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
