import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { createClient } from '../api/client';
import { apiQueue } from '../api/queue';
import { useKey } from '../key-context';
import { isTickerShaped, searchEntries, type SearchResult } from '../search';
import { useCompanyIndex } from './use-company-index';

export const SEARCH_DEBOUNCE_MS = 300;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Search (design D10). Runs on the device over the cached index 300 ms after the last keystroke.
 * Before the index is cached a name query goes to the server's name search, and a ticker-shaped
 * one waits for the index, unless the index failed to load: then it goes to the server too, and
 * the list's error banner offers Retry for the index.
 */
export function useStockSearch(text: string) {
  const { apiKey } = useKey();
  const index = useCompanyIndex();
  const raw = text.trim();
  const query = useDebounced(raw, SEARCH_DEBOUNCE_MS);
  const active = raw.length > 0;
  const pending = raw !== query;

  const onDevice = index.entries !== undefined;
  const useServer = active && !pending && !onDevice && (!isTickerShaped(query) || index.isError);
  const server = useQuery({
    queryKey: ['search', query],
    queryFn: () => createClient(apiKey ?? '', apiQueue).searchCompanies(query),
    enabled: !!apiKey && useServer,
    staleTime: 5 * 60_000,
  });

  const results = useMemo<SearchResult[]>(() => {
    if (!query) return [];
    if (index.entries) return searchEntries(index.entries, query);
    if (server.data) {
      return server.data
        .flatMap((c) => c.tickers.map((symbol) => ({ symbol, name: c.name })))
        .sort((a, b) => a.name.localeCompare(b.name) || a.symbol.localeCompare(b.symbol));
    }
    return [];
  }, [query, index.entries, server.data]);

  const waitingForIndex = !onDevice && !index.settled && isTickerShaped(query);
  const loading = active && (pending || waitingForIndex || (useServer && server.isPending));
  return { active, query: raw, results, loading };
}
