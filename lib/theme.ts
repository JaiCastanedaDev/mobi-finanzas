import { useColorScheme } from 'nativewind';

// Paleta "Mobi Finanzas" (diseño claude.ai/design, oklch → hex).
const light = {
  bg: '#faf8f4',
  card: '#fdfcf9',
  border: '#e7e4dd',
  text: '#1e1a10',
  textSub: '#686357',
  pos: '#267b4c',
  posBg: '#dcf7e5',
  neg: '#b04f49',
  primary: '#267b4c',
  primaryShadow: 'rgba(38,123,76,0.4)',
  streakBg: '#fbe7d8',
  streakBg2: '#d4f0dc',
  streakText: '#632500',
  streakDot: '#c2571f',
  amber: '#7d691f',
  terracotta: '#9c6636',
  neutral: '#d0cec7',
  tabInactive: '#6f6c61',
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
  tabInactive: '#8f8d84',
  onPrimary: '#0a0905',
};

export type Theme = typeof light;
export const themes = { light, dark };

export function useTheme(): Theme {
  const { colorScheme } = useColorScheme();
  return colorScheme === 'dark' ? themes.dark : themes.light;
}

/**
 * Texto/ícono (blanco o negro) con mayor contraste WCAG sobre un color de acento
 * arbitrario (colores de categoría en chips rellenos). Blanco fijo falla 4.5:1
 * sobre la mitad de la paleta categórica; elegir por luminancia garantiza ≥4.5:1
 * en toda la paleta sembrada y en los colores de categorías ya guardadas.
 */
export function onColor(hex: string): '#ffffff' | '#000000' {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Umbral donde el contraste de blanco y negro se iguala: (L+0.05)² = 1.05·0.05.
  return lum < 0.1791 ? '#ffffff' : '#000000';
}
