import { QueryClient } from '@tanstack/react-query';
import { persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { createMMKV } from 'react-native-mmkv';

import { CACHE_STORAGE_KEY, persistOptions } from '../persister';
import { ApiError } from '../api/client-error';
import { tickerQueryOptions } from '../hooks/use-company';
import { createQueryClient, PERSIST_MAX_AGE_MS, shouldPersistQuery } from '../query-client';

const KEY = 'idk_secret1234';

describe('query persistence', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('persists companies, company, ticker and dividends, and never prices, usage or the key', async () => {
    const store = createMMKV({ id: 'test-cache' });
    const qc: QueryClient = createQueryClient();
    qc.setQueryData(['companies'], [{ id: '1', name: 'Petrobras' }]);
    qc.setQueryData(['company', 'PETR4'], { id: '1' });
    qc.setQueryData(['dividends', 'PETR4'], [{ exDate: '2026-08-21', amount: 1 }]);
    qc.setQueryData(['ticker', 'PETR4'], { symbol: 'PETR4', companyId: '1' });
    qc.setQueryData(['prices', 'PETR4'], [{ t: 1, close: 5 }]);
    qc.setQueryData(['usage'], { keyPrefix: 'idk_secre' });

    const { persister, dehydrateOptions } = persistOptions(store);
    await persistQueryClientSave({ queryClient: qc, persister, dehydrateOptions });
    jest.runOnlyPendingTimers(); // the persister throttles writes

    const raw = store.getString(CACHE_STORAGE_KEY)!;
    expect(raw).toBeDefined();
    const keys = (JSON.parse(raw).clientState.queries as { queryKey: unknown[] }[]).map((q) => q.queryKey[0]);
    expect(keys.sort()).toEqual(['companies', 'company', 'dividends', 'ticker']);
    expect(raw).not.toContain('prices');
    expect(raw).not.toContain(KEY);
    expect(raw).not.toContain('usage');
  });

  it('keeps a ticker lookup for 7 days and does not persist a failed one', async () => {
    const qc = createQueryClient({ retryDelay: () => 0 });
    expect(qc.getDefaultOptions().queries?.gcTime).toBe(PERSIST_MAX_AGE_MS);
    expect(persistOptions(createMMKV({ id: 'test-cache' })).maxAge).toBe(PERSIST_MAX_AGE_MS);
    expect(tickerQueryOptions('k', 'PETR4').staleTime).toBe(PERSIST_MAX_AGE_MS);
    await qc.prefetchQuery({
      queryKey: ['ticker', 'GONE3'],
      queryFn: () => Promise.reject(new ApiError('notFound')),
      retry: false,
    });
    const failed = qc.getQueryCache().find({ queryKey: ['ticker', 'GONE3'] })!;
    expect(failed.state.status).toBe('error');
    expect(shouldPersistQuery(failed)).toBe(false);
  });
});
