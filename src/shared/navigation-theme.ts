// The navigation theme (header titles, back button, backgrounds) from the palette, so the large
// title and the small titles read in dark mode.
import { palettes } from './theme';

export function navigationTheme<T extends { colors: object }>(
  scheme: 'light' | 'dark',
  base: { DarkTheme: T; DefaultTheme: T },
): T {
  const p = palettes[scheme];
  const theme = scheme === 'dark' ? base.DarkTheme : base.DefaultTheme;
  return {
    ...theme,
    colors: { ...theme.colors, background: p.background, card: p.background, text: p.text, border: p.separator },
  };
}
