import { create } from 'zustand';
import { monthOf, todayISO } from '../lib/dates';

type UIState = {
  selectedMonth: string;
  categoryFilter: number | null;
  setMonth: (m: string) => void;
  setCategoryFilter: (id: number | null) => void;
};

export const useUI = create<UIState>((set) => ({
  selectedMonth: monthOf(todayISO()),
  categoryFilter: null,
  setMonth: (selectedMonth) => set({ selectedMonth, categoryFilter: null }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
}));
