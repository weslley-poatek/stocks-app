import { useQuery } from '@tanstack/react-query';

import { createClient } from '../api/client';
import { apiQueue } from '../api/queue';
import { companyIndexQueryOptions } from '../company-index';
import { PERSIST_MAX_AGE_MS } from '../query-client';
import type { Company } from '../types';
import { indexLookups } from './use-company-index';

export const companyKey = (id: string | undefined) => ['company', id] as const;
export const tickerKey = (symbol: string) => ['ticker', symbol] as const;

/** `/v1/tickers/{symbol}`, kept 7 days: used only for a symbol the company index lacks (D8). */
export function tickerQueryOptions(key: string, symbol: string) {
  return {
    queryKey: tickerKey(symbol),
    queryFn: ({ signal }: { signal: AbortSignal }) => createClient(key, apiQueue).ticker(symbol, { signal }),
    staleTime: PERSIST_MAX_AGE_MS,
  };
}

/**
 * The company of a symbol. It comes from the cached company index (read only, never fetched here,
 * so opening details from the list makes no company request). A symbol missing from the index is
 * looked up with `/v1/tickers/{symbol}` then `/v1/companies/{id}`. A null `company_id` means
 * there is no company (design D15).
 */
export function useCompany(symbol: string, apiKey: string | null): Company | undefined {
  const index = useQuery({ ...companyIndexQueryOptions(apiKey ?? ''), enabled: false });
  const fromIndex = index.data ? indexLookups(index.data).byTicker.get(symbol) : undefined;
  const lookup = fromIndex === undefined && apiKey !== null;

  const ticker = useQuery({ ...tickerQueryOptions(apiKey ?? '', symbol), enabled: lookup });
  const companyId = ticker.data?.companyId;
  const fetched = useQuery({
    queryKey: companyKey(companyId),
    queryFn: ({ signal }) => createClient(apiKey as string, apiQueue).company(companyId as string, { signal }),
    staleTime: PERSIST_MAX_AGE_MS,
    enabled: lookup && companyId !== undefined,
  });

  return fromIndex ?? fetched.data;
}
