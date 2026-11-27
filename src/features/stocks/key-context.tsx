import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { onUnauthorized } from './api/unauthorized';

const STORE_KEY = 'investingdata-api-key';

type KeyState = {
  ready: boolean;
  apiKey: string | null;
  /** True after the stored key got a 401; the key stays stored (design D3). */
  rejected: boolean;
  save: (key: string) => Promise<void>;
  remove: () => Promise<void>;
};

const KeyContext = createContext<KeyState | null>(null);

export function KeyProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    let live = true;
    SecureStore.getItemAsync(STORE_KEY)
      .catch(() => null)
      .then((k) => {
        if (!live) return;
        setApiKey(k);
        setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // A 401 for the stored key sends the user to the key screen. A 401 for a key being tried is
  // the key screen's own business.
  useEffect(
    () =>
      onUnauthorized((key) => {
        if (apiKey !== null && key === apiKey) setRejected(true);
      }),
    [apiKey],
  );

  const save = useCallback(async (key: string) => {
    await SecureStore.setItemAsync(STORE_KEY, key);
    setApiKey(key);
    setRejected(false);
  }, []);

  const remove = useCallback(async () => {
    await SecureStore.deleteItemAsync(STORE_KEY);
    setApiKey(null);
    setRejected(false);
  }, []);

  const value = useMemo<KeyState>(
    () => ({ ready, apiKey, rejected, save, remove }),
    [ready, apiKey, rejected, save, remove],
  );
  return <KeyContext.Provider value={value}>{children}</KeyContext.Provider>;
}

export function useKey(): KeyState {
  const v = useContext(KeyContext);
  if (!v) throw new Error('useKey needs a KeyProvider');
  return v;
}
