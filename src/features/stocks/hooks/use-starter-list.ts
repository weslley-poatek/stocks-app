import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { isApiError } from '../api/client-error';
import { Priority } from '../api/queue';
import { useKey } from '../key-context';
import { pricesQueryOptions } from '../prices';
import { toRowData, type RowData } from '../row-data';
import { STARTERS } from '../starter';
import { readStarterOrder, writeStarterOrder } from '../starter-order';
import { tickerQueryOptions } from './use-company';
import { useCompanyIndex } from './use-company-index';
import { useSeeded } from './use-seeded';

/** The first rows are on screen; later starters wait behind them in the queue. */
const VISIBLE_COUNT = 10;

const isNotFound = (e: unknown) => isApiError(e, 'notFound');

export type StarterRow = RowData & { loading: boolean };

/**
 * The starter list. Starters are checked against the company index and `/v1/tickers/{symbol}` is
 * used only for one the index lacks (D8). Rows show in the last session's volume order, or starter
 * order on a first run, and re-sort by volume once every history has arrived (D9). A starter the
 * API reports as not found is left out.
 */
export function useStarterList() {
  const { apiKey } = useKey();
  const index = useCompanyIndex();
  const seeded = useSeeded(STARTERS);
  const [order] = useState(readStarterOrder);

  const key = apiKey ?? '';
  const ready = !!apiKey && index.settled && seeded;
  // Without an index (it failed), there is nothing to validate against: only a 404 price drops one.
  const missing = index.companies ? STARTERS.filter((s) => !index.byTicker.has(s)) : [];

  const lookups = useQueries({
    queries: missing.map((symbol) => ({ ...tickerQueryOptions(key, symbol), enabled: ready })),
  });
  const lookupOf = new Map(missing.map((s, i) => [s, lookups[i]]));

  const prices = useQueries({
    queries: STARTERS.map((symbol, i) => {
      const lookup = lookupOf.get(symbol);
      return {
        ...pricesQueryOptions(key, symbol, i < VISIBLE_COUNT ? Priority.visible : Priority.offscreen),
        enabled: ready && (!lookup || lookup.isSuccess),
      };
    }),
  });

  const states = STARTERS.map((symbol, i) => {
    const price = prices[i];
    const lookup = lookupOf.get(symbol);
    const dropped = isNotFound(price.error) || isNotFound(lookup?.error);
    const failed = !dropped && !price.data && (price.isError || !!lookup?.isError);
    return { symbol, price, lookup, dropped, failed };
  });

  const shown = states.filter((s) => !s.dropped && !s.failed);
  const allSettled = ready && shown.every((s) => s.price.data);

  const byVolume = (a: StarterRow, b: StarterRow) => (b.volume ?? -1) - (a.volume ?? -1);
  const rows: StarterRow[] = shown.map((s) => ({
    ...toRowData(s.symbol, s.price.data, index.byTicker.get(s.symbol)),
    loading: !s.price.data,
  }));
  if (allSettled) rows.sort(byVolume);
  else rows.sort((a, b) => order.indexOf(a.symbol) - order.indexOf(b.symbol));

  const savedOrder = allSettled ? rows.map((r) => r.symbol).join() : '';
  useEffect(() => {
    if (savedOrder) writeStarterOrder(savedOrder.split(','));
  }, [savedOrder]);

  const error = states.some((s) => s.failed) || index.isError;

  function retry() {
    for (const s of states) {
      if (s.failed) void (s.lookup?.isError ? s.lookup.refetch() : s.price.refetch());
    }
    if (index.isError) void index.refetch();
  }

  return {
    /** True until the index has settled and the stored histories are seeded: show skeleton rows. */
    initializing: !ready,
    rows,
    error,
    retry,
  };
}
