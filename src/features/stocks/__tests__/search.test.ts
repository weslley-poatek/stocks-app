import { buildSearchEntries, isTickerShaped, normalize, searchEntries } from '../search';
import type { Company } from '../types';

const co = (name: string, legalName: string, tickers: string[]): Company => ({ id: name, name, legalName, tickers });
const entries = buildSearchEntries([
  co('Petrobras', 'PETRÓLEO BRASILEIRO S.A. PETROBRAS', ['PETR4', 'PETR3']),
  co('Petrorecôncavo', 'PETRORECONCAVO S.A.', ['RECV3']),
  co('Vale', 'VALE S.A.', ['VALE3']),
  co('Itaú Unibanco', 'ITAU UNIBANCO HOLDING S.A.', ['ITUB4']),
]);
const symbols = (q: string) => searchEntries(entries, q).map((r) => r.symbol);

describe('search', () => {
  it('matches a ticker prefix, case-insensitively, alphabetical', () => {
    expect(symbols('PETR')).toEqual(['PETR3', 'PETR4', 'RECV3']);
    expect(symbols('petr4')).toEqual(['PETR4']);
  });
  it('puts ticker matches before name matches', () => {
    // "va" is a ticker prefix (VALE3) and a name substring of nothing else; "itau" matches a name only.
    expect(symbols('va')).toEqual(['VALE3']);
    expect(symbols('ITAU')).toEqual(['ITUB4']);
    expect(searchEntries(buildSearchEntries([co('Banco Vale', 'BANCO VALE', ['BVAL3']), co('Vale', 'VALE', ['VALE3'])]), 'vale').map((r) => r.symbol)).toEqual(['VALE3', 'BVAL3']);
  });
  it('matches a display or legal name substring, ignoring accents and case', () => {
    expect(symbols('petrobras')).toEqual(['PETR3', 'PETR4']);
    expect(symbols('petroleo')).toEqual(['PETR3', 'PETR4']);
    expect(symbols('PETRÓLEO')).toEqual(['PETR3', 'PETR4']);
    expect(symbols('itaú')).toEqual(['ITUB4']);
    expect(symbols('zzzz')).toEqual([]);
    expect(symbols('  ')).toEqual([]);
  });
  it('normalizes diacritics and case', () => {
    expect(normalize(' Petróleo ')).toBe('petroleo');
  });
  it('tells a ticker-shaped query from a name', () => {
    expect(isTickerShaped('PETR')).toBe(true);
    expect(isTickerShaped('BPAC11')).toBe(true);
    expect(isTickerShaped('petr4')).toBe(true);
    expect(isTickerShaped('bpac11')).toBe(true);
    expect(isTickerShaped('petr')).toBe(false);
    expect(isTickerShaped('Vale')).toBe(false);
    expect(isTickerShaped('Itau')).toBe(false);
    expect(isTickerShaped('petrobras')).toBe(false);
    expect(isTickerShaped('ITAU UNIBANCO')).toBe(false);
  });
});
