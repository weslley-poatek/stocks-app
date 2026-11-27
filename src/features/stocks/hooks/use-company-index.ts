import { useQuery } from '@tanstack/react-query';

import { companyIndexQueryOptions } from '../company-index';
import { useKey } from '../key-context';
import { buildSearchEntries, type SearchEntry } from '../search';
import type { Company } from '../types';

type Lookups = { byTicker: Map<string, Company>; entries: SearchEntry[] };

// Built once per index (every observer of the `companies` query shares the same array).
const lookups = new WeakMap<Company[], Lookups>();
const NO_COMPANIES = new Map<string, Company>();

/** The ticker map and search entries of an index, built once and shared. */
export function indexLookups(companies: Company[]): Lookups {
  let l = lookups.get(companies);
  if (!l) {
    const byTicker = new Map<string, Company>();
    for (const c of companies) for (const t of c.tickers) byTicker.set(t, c);
    l = { byTicker, entries: buildSearchEntries(companies) };
    lookups.set(companies, l);
  }
  return l;
}

/** The company index (7-day cache), with the lookups the list and search need. */
export function useCompanyIndex() {
  const { apiKey } = useKey();
  const q = useQuery({ ...companyIndexQueryOptions(apiKey ?? ''), enabled: !!apiKey });
  const l = q.data ? indexLookups(q.data) : undefined;
  return {
    companies: q.data,
    byTicker: l?.byTicker ?? NO_COMPANIES,
    entries: l?.entries,
    /** Success or failure: starters stop waiting for the index. */
    settled: q.isSuccess || q.isError,
    isError: q.isError,
    refetch: q.refetch,
  };
}
