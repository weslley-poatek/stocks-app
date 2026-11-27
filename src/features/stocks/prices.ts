import type { QueryClient } from '@tanstack/react-query';

import { createClient } from './api/client';
import { apiQueue, Priority } from './api/queue';
import { canRefresh, isStale, readHistory, STALE_AFTER_MS, writeHistory } from './history-store';
import type { Bar } from './types';

/** The query key for a history. It never holds the API key, and `prices` is never persisted (D6). */
export const pricesKey = (symbol: string) => ['prices', symbol] as const;

/**
 * Loads a history. A stored file is used while it is fresh (12 h at launch, or 15 minutes for
 * `refresh`, the pull-to-refresh case); otherwise one request is made and the file is rewritten.
 */
export async function loadHistory(
  key: string,
  symbol: string,
  {
    refresh = false,
    now = Date.now(),
    priority = Priority.visible,
  }: { refresh?: boolean; now?: number; priority?: number } = {},
): Promise<Bar[]> {
  const stored = await readHistory(symbol);
  if (stored && !(refresh ? canRefresh(stored.fetchedAt, now) : isStale(stored.fetchedAt, now))) {
    return stored.bars;
  }
  const bars = await createClient(key, apiQueue).price(symbol, { priority });
  try {
    await writeHistory(symbol, bars, now);
  } catch {
    // The bars were fetched; a failed disk write only means the next launch fetches again.
    // Nothing is logged: the error could carry the history's contents.
  }
  return bars;
}

/** The `prices` query: seeds from the stored file, and is stale after 12 h. */
export function pricesQueryOptions(key: string, symbol: string, priority: number = Priority.visible) {
  return {
    queryKey: pricesKey(symbol),
    queryFn: () => loadHistory(key, symbol, { priority }),
    staleTime: STALE_AFTER_MS,
  };
}

/**
 * Pull to refresh: refetches the given symbols whose last fetch is 15 minutes old or more. One
 * failed history doesn't stop the rest; resolves to whether any failed.
 */
export async function refreshHistories(qc: QueryClient, key: string, symbols: readonly string[]): Promise<boolean> {
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const bars = await loadHistory(key, symbol, { refresh: true });
      qc.setQueryData(pricesKey(symbol), bars);
    }),
  );
  return results.some((r) => r.status === 'rejected');
}

/**
 * Seeds the `prices` query from the stored file, stamped with the file's fetch time, so the query
 * is stale exactly when the file is and a failed refetch keeps the stored rows (offline launch).
 */
export async function seedHistory(qc: QueryClient, symbol: string): Promise<void> {
  if (qc.getQueryData(pricesKey(symbol))) return;
  const stored = await readHistory(symbol);
  if (stored && !qc.getQueryData(pricesKey(symbol))) {
    qc.setQueryData(pricesKey(symbol), stored.bars, { updatedAt: stored.fetchedAt });
  }
}
