import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Pressable, Text, View } from 'react-native';
import { icons } from '../lib/iconMap';
import { onColor, useTheme } from '../lib/theme';
import { db } from '../db/client';
import { categories } from '../db/schema';

type Props = { kind: 'gasto' | 'ingreso'; selectedId: number | null; onSelect: (id: number) => void };

export function CategoryGrid({ kind, selectedId, onSelect }: Props) {
  const t = useTheme();
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
            className="mb-2 mr-2 flex-row items-center rounded-full px-[13px] py-2"
            style={{
              backgroundColor: selected ? cat.color : t.card,
              borderWidth: 1,
              borderColor: selected ? cat.color : t.border,
            }}
          >
            <Icon size={14} color={selected ? onColor(cat.color) : cat.color} />
            <Text className="ml-1.5 text-[11.5px] font-semibold" style={{ color: selected ? onColor(cat.color) : t.text }} numberOfLines={1}>
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
