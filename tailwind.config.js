/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Paleta "Mobi Finanzas" — mantener en sincronía con lib/theme.ts
      colors: {
        bg: { DEFAULT: '#faf8f4', dark: '#0f0d06' },
        card: { DEFAULT: '#fdfcf9', dark: '#1a1911' },
        line: { DEFAULT: '#e7e4dd', dark: '#2a2922' },
        ink: { DEFAULT: '#1e1a10', dark: '#f3f2ed' },
        sub: { DEFAULT: '#686357', dark: '#918f88' },
        pos: { DEFAULT: '#267b4c', dark: '#51b67a' },
        posbg: { DEFAULT: '#cff2da', dark: '#12301e' },
        neg: { DEFAULT: '#c46761', dark: '#eb827b' },
        primary: { DEFAULT: '#267b4c', dark: '#3fa66b' },
        onprimary: { DEFAULT: '#ffffff', dark: '#0a0905' },
        streakbg: { DEFAULT: '#fbe7d8', dark: '#392316' },
        streakbg2: { DEFAULT: '#d4f0dc', dark: '#12301e' },
        streaktext: { DEFAULT: '#632500', dark: '#f9bf9f' },
      },
      borderRadius: {
        card: '18px',
        row: '16px',
        sheet: '22px',
        field: '12px',
        btn: '14px',
      },
    },
  },
  plugins: [],
};
