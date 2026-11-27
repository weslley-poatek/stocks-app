import { createClient } from './api/client';
import { apiQueue, Priority } from './api/queue';
import { PERSIST_MAX_AGE_MS } from './query-client';
import type { Company } from './types';

export const companyIndexKey = ['companies'] as const;

/** Every page of `/v1/companies?country_code=BR&limit=100`, each fetched once. */
export async function fetchCompanyIndex(key: string, signal?: AbortSignal): Promise<Company[]> {
  const api = createClient(key, apiQueue);
  const first = await api.companies(1, { signal });
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.pageCount - 1) }, (_, i) =>
      api.companies(i + 2, { signal, priority: Priority.offscreen }),
    ),
  );
  return [first, ...rest].flatMap((p) => p.companies);
}

/** The `companies` query: kept 7 days, so a launch inside that makes no request. */
export function companyIndexQueryOptions(key: string) {
  return {
    queryKey: companyIndexKey,
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchCompanyIndex(key, signal),
    staleTime: PERSIST_MAX_AGE_MS, // 7 days
  };
}
