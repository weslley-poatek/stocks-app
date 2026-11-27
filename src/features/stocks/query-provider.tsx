import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useState, type ReactNode } from 'react';

import { appCacheStore, persistOptions } from './persister';
import { createQueryClient } from './query-client';

/** Wraps the app in a QueryClient whose `companies`, `company` and `dividends` queries persist to MMKV. */
export function AppQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  const [options] = useState(() => persistOptions(appCacheStore()));
  return (
    <PersistQueryClientProvider client={client} persistOptions={options}>
      {children}
    </PersistQueryClientProvider>
  );
}
