import { useQuery } from '@tanstack/react-query';

import { createClient } from '../api/client';
import { apiQueue } from '../api/queue';
import { PERSIST_MAX_AGE_MS } from '../query-client';

// v2: lists cached before the epoch ex-date fix are empty and must not be reused.
export const dividendsKey = (symbol: string) => ['dividends', 'v2', symbol] as const;

/** A symbol's dividends: kept 7 days (persisted), never refetched on focus, lowest priority. */
export function useDividends(symbol: string, apiKey: string | null) {
  return useQuery({
    queryKey: dividendsKey(symbol),
    queryFn: ({ signal }) =>
      createClient(apiKey as string, apiQueue).dividends(symbol, { signal }),
    staleTime: PERSIST_MAX_AGE_MS,
    refetchOnMount: false,
    enabled: apiKey !== null,
  });
}
