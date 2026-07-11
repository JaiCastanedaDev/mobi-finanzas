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

const COLORES = ['#267b4c', '#df6c32', '#2f7fbe', '#ab8b3d', '#7d6bc4', '#0f9f88', '#c46761', '#6b7f2e', '#a3599a', '#b0752b'];

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
    <View className="flex-1 bg-bg p-4 dark:bg-bg-dark">
      <FlatList
        data={cats ?? []}
        keyExtractor={(c) => String(c.id)}
        renderItem={({ item: c }) => {
          const Icon = icons[c.icon as keyof typeof icons] ?? icons.Circle;
          return (
            <Pressable
              onLongPress={() => onRemove(c.id, c.name)}
              className="mb-2 flex-row items-center rounded-row border border-line bg-card p-3 dark:border-line-dark dark:bg-card-dark"
            >
              <View className="mr-3 h-9 w-9 items-center justify-center rounded-[11px]" style={{ backgroundColor: `${c.color}33` }}>
                <Icon color={c.color} size={17} />
              </View>
              <Text className="flex-1 text-[13px] font-semibold text-ink dark:text-ink-dark">{c.name}</Text>
              <Text className="text-[10.5px] font-medium capitalize text-sub dark:text-sub-dark">{c.kind}</Text>
            </Pressable>
          );
        }}
        ListFooterComponent={
          formOpen ? (
            <View className="rounded-card border border-line bg-card p-4 dark:border-line-dark dark:bg-card-dark">
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
                    className={`mb-2 mr-2 h-8 w-8 rounded-full ${color === c ? 'border-2 border-ink dark:border-ink-dark' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </View>
              {error ? <Text className="mb-2 text-xs text-neg dark:text-neg-dark">{error}</Text> : null}
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
