import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatShortDate,
  formatSignedCurrency,
} from './format';

let mockTag = 'pt-BR';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: mockTag }] }));

const nbsp = (s: string) => s.replace(/ /g, ' ');

describe('format', () => {
  afterEach(() => {
    mockTag = 'pt-BR';
  });

  it('Brazilian locale', () => {
    expect(nbsp(formatCurrency(37.85))).toBe('R$ 37,85');
  });

  it('English locale', () => {
    mockTag = 'en-US';
    expect(formatPercent(0.012)).toBe('+1.20%');
    expect(formatPercent(-0.012)).toBe('\u22121.20%');
    expect(formatPercent(0.1, { signed: false, digits: 1 })).toBe('10.0%');
    expect(formatSignedCurrency(0.44)).toBe('+R$0.44');
  });

  it('adds the sign by hand, with a minus sign, and none for zero', () => {
    expect(formatPercent(0.0098)).toBe('+0,98%');
    expect(formatPercent(-0.008)).toBe('\u22120,80%');
    expect(formatPercent(0)).toBe('0,00%');
    expect(formatPercent(-0.00001)).toBe('0,00%');
    expect(nbsp(formatSignedCurrency(0.51))).toBe('+R$ 0,51');
    expect(nbsp(formatSignedCurrency(-0.51))).toBe('\u2212R$ 0,51');
    expect(formatSignedCurrency(0)).not.toMatch(/[+\u2212]/);
  });

  it('does not rely on Intl signDisplay', () => {
    const real = Intl.NumberFormat;
    const spy = jest.spyOn(Intl, 'NumberFormat').mockImplementation(((l: string, o: Intl.NumberFormatOptions) =>
      real(l, { ...o, signDisplay: undefined })) as never);
    try {
      expect(formatPercent(0.0098)).toBe('+0,98%');
      expect(nbsp(formatSignedCurrency(0.51))).toBe('+R$ 0,51');
    } finally {
      spy.mockRestore();
    }
  });

  it('compact market caps', () => {
    mockTag = 'en-US';
    expect(formatCompactCurrency(493_700_000_000)).toBe('R$493.7B');
    expect(formatCompactNumber(12_300_000)).toBe('12.3M');
    mockTag = 'pt-BR';
    expect(nbsp(formatCompactCurrency(493_700_000_000))).toBe('R$ 493,7 bi');
  });

  it('short dates', () => {
    expect(formatShortDate('2025-11-25', 'en-GB')).toBe('25 Nov');
    expect(formatShortDate('2025-11-25', 'en-US')).toBe('Nov 25');
    expect(formatShortDate('2025-11-25T00:00:00Z', 'en-GB')).toBe('25 Nov');
  });

  it('falls back to en-US with no locales', () => {
    jest.resetModules();
    jest.doMock('expo-localization', () => ({ getLocales: () => [] }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fresh = require('./format');
    expect(fresh.formatPercent(0.012)).toBe('+1.20%');
  });
});
