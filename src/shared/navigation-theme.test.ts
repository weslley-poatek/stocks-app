import { navigationTheme } from './navigation-theme';
import { darkPalette, lightPalette } from './theme';

const base = {
  DarkTheme: { dark: true, colors: { primary: 'x', background: 'black', card: 'k', text: 'dark-default', border: 'b' } },
  DefaultTheme: { dark: false, colors: { primary: 'x', background: 'white', card: 'w', text: 'light-default', border: 'b' } },
};

describe('navigationTheme', () => {
  it('dark: light text on the dark palette background', () => {
    const t = navigationTheme('dark', base);
    expect(t.dark).toBe(true);
    expect(t.colors.text).toBe(darkPalette.text);
    expect(t.colors.background).toBe(darkPalette.background);
  });
  it('light: dark text on the light palette background', () => {
    const t = navigationTheme('light', base);
    expect(t.colors.text).toBe(lightPalette.text);
    expect(t.colors.card).toBe(lightPalette.background);
  });
});
