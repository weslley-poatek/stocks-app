import { QueryClient, type Query } from '@tanstack/react-query';

import { isApiError } from './api/client-error';

/** Cached data lives 7 days (design D6); the persister's maxAge matches it. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 3_600_000;

/** Retry only `network` errors, twice (design D5). 4xx never retry; `rateLimited` is the queue's job. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return isApiError(error, 'network') && failureCount < 2;
}

export const retryDelay = (attempt: number): number => Math.min(1000 * 2 ** attempt, 30_000);

export function createQueryClient(opts: { retryDelay?: (attempt: number) => number } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay: opts.retryDelay ?? retryDelay,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
        gcTime: PERSIST_MAX_AGE_MS,
      },
    },
  });
}

/** Only these query keys are persisted to MMKV (design D6; `ticker` is D8's 7-day lookup). `prices` and `usage` never are. */
export const PERSISTED_KEYS: readonly unknown[] = ['companies', 'company', 'dividends', 'ticker'];

export const shouldPersistQuery = (query: Query): boolean =>
  query.state.status === 'success' && PERSISTED_KEYS.includes(query.queryKey[0]);
