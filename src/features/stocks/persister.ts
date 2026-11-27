import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { createMMKV } from 'react-native-mmkv';

import { PERSIST_MAX_AGE_MS, shouldPersistQuery } from './query-client';

export const CACHE_STORAGE_KEY = 'stocks-query-cache';

type SyncStore = {
  getString(k: string): string | undefined;
  set(k: string, v: string): void;
  remove(k: string): unknown;
};

/** Adapts a synchronous MMKV store to the Storage shape the persister wants. */
export function mmkvStorage(store: SyncStore) {
  return {
    getItem: (k: string) => store.getString(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => void store.remove(k),
  };
}

export function createCachePersister(store: SyncStore) {
  return createSyncStoragePersister({ storage: mmkvStorage(store), key: CACHE_STORAGE_KEY });
}

/** Persist options with the dehydrate filter that leaves out everything but the cached index and details data. */
export function persistOptions(store: SyncStore): Omit<PersistQueryClientOptions, 'queryClient'> {
  return {
    persister: createCachePersister(store),
    maxAge: PERSIST_MAX_AGE_MS,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
}

let appStore: ReturnType<typeof createMMKV> | undefined;
export const appCacheStore = () => (appStore ??= createMMKV({ id: 'query-cache' }));
