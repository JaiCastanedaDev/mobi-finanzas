import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { monthLabel, monthOf, shiftMonth, todayISO } from '../lib/dates';
import { useUI } from '../store/ui';

export function MonthSelector() {
  const { selectedMonth, setMonth } = useUI();
  const currentMonth = monthOf(todayISO());
  return (
    <View className="flex-row items-center justify-center py-2">
      <Pressable onPress={() => setMonth(shiftMonth(selectedMonth, -1))} className="p-2">
        <ChevronLeft size={20} color="#737373" />
      </Pressable>
      <Text className="w-32 text-center font-semibold text-neutral-900 dark:text-white">{monthLabel(selectedMonth)}</Text>
      <Pressable
        onPress={() => setMonth(shiftMonth(selectedMonth, 1))}
        disabled={selectedMonth >= currentMonth}
        className={`p-2 ${selectedMonth >= currentMonth ? 'opacity-30' : ''}`}
      >
        <ChevronRight size={20} color="#737373" />
      </Pressable>
    </View>
  );
}
