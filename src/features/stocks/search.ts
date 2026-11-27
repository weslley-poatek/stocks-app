// Search over the company index (design D10). Pure: no React, no I/O.
import type { Company } from './types';

/** Lower case, diacritics stripped (NFD), so "Petróleo" and "petroleo" match. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export type SearchEntry = {
  symbol: string;
  /** The company's display name. */
  name: string;
  normName: string;
  normLegal: string;
};

export type SearchResult = { symbol: string; name: string };

/** One entry per ticker, carrying its company's normalized names. */
export function buildSearchEntries(companies: readonly Company[]): SearchEntry[] {
  return companies.flatMap((c) => {
    const normName = normalize(c.name);
    const normLegal = normalize(c.legalName);
    return c.tickers.map((symbol) => ({ symbol, name: c.name, normName, normLegal }));
  });
}

/**
 * Ticker prefix matches first, then display or legal name substring matches, alphabetical within
 * each group (tickers by symbol, names by company name then symbol).
 */
export function searchEntries(entries: readonly SearchEntry[], query: string, limit = 50): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const byTicker: SearchEntry[] = [];
  const byName: SearchEntry[] = [];
  for (const e of entries) {
    if (e.symbol.toLowerCase().startsWith(q)) byTicker.push(e);
    else if (e.normName.includes(q) || e.normLegal.includes(q)) byName.push(e);
  }
  byTicker.sort((a, b) => a.symbol.localeCompare(b.symbol));
  byName.sort((a, b) => a.normName.localeCompare(b.normName) || a.symbol.localeCompare(b.symbol));
  const seen = new Set<string>();
  return [...byTicker, ...byName]
    .filter((e) => !seen.has(e.symbol) && seen.add(e.symbol))
    .slice(0, limit)
    .map(({ symbol, name }) => ({ symbol, name }));
}

/**
 * Whether a query could be a ticker: up to 6 letters and digits that are all upper case (PETR,
 * PETR4) or hold a digit (petr4). Lower or mixed case letters without a digit ("Vale", "itau"),
 * accents, a space or a longer word are a name, so they can use the server's name search before
 * the index is cached.
 */
export function isTickerShaped(query: string): boolean {
  const q = query.trim();
  return /^[A-Z0-9]{1,6}$/.test(q) || (/^[A-Za-z0-9]{1,6}$/.test(q) && /\d/.test(q));
}
