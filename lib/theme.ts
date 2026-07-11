import { useColorScheme } from 'nativewind';

// Paleta "Mobi Finanzas" (diseño claude.ai/design, oklch → hex).
const light = {
  bg: '#faf8f4',
  card: '#fdfcf9',
  border: '#e7e4dd',
  text: '#1e1a10',
  textSub: '#686357',
  pos: '#267b4c',
  posBg: '#cff2da',
  neg: '#c46761',
  primary: '#267b4c',
  primaryShadow: 'rgba(38,123,76,0.4)',
  streakBg: '#fbe7d8',
  streakBg2: '#d4f0dc',
  streakText: '#632500',
  streakDot: '#df6c32',
  amber: '#aa8f44',
  terracotta: '#c4936b',
  neutral: '#d0cec7',
  tabInactive: '#b0aea7',
  onPrimary: '#ffffff',
};

const dark: Theme = {
  bg: '#0f0d06',
  card: '#1a1911',
  border: '#2a2922',
  text: '#f3f2ed',
  textSub: '#918f88',
  pos: '#51b67a',
  posBg: '#12301e',
  neg: '#eb827b',
  primary: '#3fa66b',
  primaryShadow: 'rgba(0,0,0,0.5)',
  streakBg: '#392316',
  streakBg2: '#12301e',
  streakText: '#f9bf9f',
  streakDot: '#ed7940',
  amber: '#b49c5a',
  terracotta: '#cf976a',
  neutral: '#44433b',
  tabInactive: '#57564e',
  onPrimary: '#0a0905',
};

export type Theme = typeof light;
export const themes = { light, dark };

export function useTheme(): Theme {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? themes.dark : themes.light;
}
