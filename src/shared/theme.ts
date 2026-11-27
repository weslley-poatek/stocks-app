// Light and dark palettes, up and down colours, and the type scale.
import { Platform, useColorScheme } from 'react-native';

export type Palette = {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  separator: string;
  up: string;
  down: string;
  /** Pills: text on the pill's own colour must reach 4.5:1 (WCAG AA). */
  pill: { up: { bg: string; text: string }; down: { bg: string; text: string } };
};

export const lightPalette: Palette = {
  background: '#FFFFFF',
  surface: '#F2F2F7',
  text: '#111111',
  textSecondary: '#5C5C63',
  separator: '#D1D1D6',
  up: '#17803D',
  down: '#C62828',
  pill: {
    up: { bg: '#17803D', text: '#FFFFFF' },
    down: { bg: '#C62828', text: '#FFFFFF' },
  },
};

export const darkPalette: Palette = {
  background: '#000000',
  surface: '#1C1C1E',
  text: '#F5F5F7',
  textSecondary: '#A1A1A8',
  separator: '#38383A',
  up: '#4ADE80',
  down: '#FF6B6B',
  pill: {
    up: { bg: '#4ADE80', text: '#04210F' },
    down: { bg: '#FF6B6B', text: '#2A0505' },
  },
};

export const palettes = { light: lightPalette, dark: darkPalette } as const;

/** The palette for the device's colour scheme. */
export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? palettes.dark : palettes.light;
}

/** A monospaced font, for API keys. */
export const monoFont = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const typeScale = {
  ticker: { fontSize: 17, fontWeight: '600' },
  name: { fontSize: 13, fontWeight: '400' },
  close: { fontSize: 34, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;
