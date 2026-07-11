import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { monthLabel, monthOf, shiftMonth, todayISO } from '../lib/dates';
import { useTheme } from '../lib/theme';
import { useUI } from '../store/ui';

export function MonthSelector({ className = '' }: { className?: string }) {
  const { selectedMonth, setMonth } = useUI();
  const t = useTheme();
  const currentMonth = monthOf(todayISO());
  const atCurrent = selectedMonth >= currentMonth;
  return (
    <View className={`flex-row items-center ${className}`}>
      <Pressable
        onPress={() => setMonth(shiftMonth(selectedMonth, -1))}
        className="h-8 w-8 items-center justify-center rounded-full border border-line bg-card dark:border-line-dark dark:bg-card-dark"
      >
        <ChevronLeft size={16} color={t.textSub} />
      </Pressable>
      <View className="mx-2 rounded-full bg-streakbg px-3 py-[7px] dark:bg-streakbg-dark">
        <Text className="text-[11.5px] font-semibold capitalize text-streaktext dark:text-streaktext-dark">{monthLabel(selectedMonth)}</Text>
      </View>
      <Pressable
        onPress={() => setMonth(shiftMonth(selectedMonth, 1))}
        disabled={atCurrent}
        className={`h-8 w-8 items-center justify-center rounded-full border border-line bg-card dark:border-line-dark dark:bg-card-dark ${atCurrent ? 'opacity-30' : ''}`}
      >
        <ChevronRight size={16} color={t.textSub} />
      </Pressable>
    </View>
  );
}
