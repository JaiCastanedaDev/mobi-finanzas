import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { icons } from '../../lib/iconMap';
import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { Field } from '../../components/ui/Field';
import { db } from '../../db/client';
import { categories } from '../../db/schema';
import { createCategory, removeCategory } from '../../db/repos/categories';

const COLORES = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

export default function Categorias() {
  const { data: cats } = useLiveQuery(db.select().from(categories).where(isNull(categories.archivedAt)));
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'gasto' | 'ingreso'>('gasto');
  const [color, setColor] = useState(COLORES[0]);
  const [error, setError] = useState('');

  function onCreate() {
    try {
      createCategory(db, { name, kind, icon: 'Tag', color });
      setFormOpen(false);
      setName('');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }

  function onRemove(id: number, catName: string) {
    Alert.alert(`Eliminar "${catName}"`, 'Si tiene movimientos se archivará para conservar el historial.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => removeCategory(db, id) },
    ]);
  }

  return (
    <View className="flex-1 bg-neutral-100 p-4 dark:bg-neutral-950">
      <FlatList
        data={cats ?? []}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item: c }) => {
          const Icon = icons[c.icon as keyof typeof icons] ?? icons.Circle;
          return (
            <Pressable onLongPress={() => onRemove(c.id, c.name)} className="mb-2 flex-row items-center rounded-2xl bg-white p-3 dark:bg-neutral-900">
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: `${c.color}33` }}>
                <Icon color={c.color} size={18} />
              </View>
              <Text className="flex-1 text-neutral-900 dark:text-white">{c.name}</Text>
              <Text className="text-xs capitalize text-neutral-500">{c.kind}</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          formOpen ? (
            <View className="rounded-2xl bg-white p-4 dark:bg-neutral-900">
              <Field label="Nombre" value={name} onChangeText={setName} />
              <View className="mb-3 flex-row">
                <Chip label="Gasto" selected={kind === 'gasto'} onPress={() => setKind('gasto')} />
                <Chip label="Ingreso" selected={kind === 'ingreso'} onPress={() => setKind('ingreso')} />
              </View>
              <View className="mb-3 flex-row flex-wrap">
                {COLORES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className={`mr-2 h-8 w-8 rounded-full ${color === c ? 'border-2 border-neutral-900 dark:border-white' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </View>
              {error ? <Text className="mb-2 text-red-500">{error}</Text> : null}
              <Button label="Crear" onPress={onCreate} />
              <View className="h-2" />
              <Button label="Cancelar" variant="ghost" onPress={() => setFormOpen(false)} />
            </View>
          ) : (
            <Button label="+ Nueva categoría" variant="ghost" onPress={() => setFormOpen(true)} />
          )
        }
      />
    </View>
  );
}
