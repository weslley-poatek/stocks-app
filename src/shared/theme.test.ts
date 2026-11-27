import { darkPalette, lightPalette, typeScale } from './theme';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('theme', () => {
  it.each([
    ['light', lightPalette],
    ['dark', darkPalette],
  ])('pill text meets 4.5:1 on its pill colour (%s)', (_name, palette) => {
    for (const pill of [palette.pill.up, palette.pill.down]) {
      expect(contrast(pill.text, pill.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('contrast helper is sane', () => expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5));

  it('up and down colours differ in both palettes', () => {
    expect(lightPalette.up).not.toBe(lightPalette.down);
    expect(darkPalette.up).not.toBe(darkPalette.down);
  });

  it('type scale', () => {
    expect(typeScale.ticker).toEqual({ fontSize: 17, fontWeight: '600' });
    expect(typeScale.name.fontSize).toBe(13);
    expect(typeScale.close).toEqual({ fontSize: 34, fontWeight: '600' });
  });
});
