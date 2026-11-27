import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { createClient } from '@/features/stocks/api/client';
import { apiQueue } from '@/features/stocks/api/queue';
import { KeyButton } from '@/features/stocks/key/key-button';
import { AppQueryProvider } from '@/features/stocks/query-provider';
import { navigationTheme } from '@/shared/navigation-theme';
import { KeyProvider, useKey } from '@/features/stocks/key-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Routes() {
  const { ready, apiKey, rejected } = useKey();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Once per stored key: read the plan's per-minute limit into the queue (`usage()` does the
  // configure). A failure must not block the list; a 401 reaches the key context on its own.
  useEffect(() => {
    if (!ready || !apiKey) return;
    createClient(apiKey, apiQueue)
      .usage()
      .catch(() => {});
  }, [ready, apiKey]);

  if (!ready) return null;
  const canBrowse = apiKey !== null && !rejected;
  return (
    <Stack>
      <Stack.Screen name="key" options={{ title: '', headerShadowVisible: false }} />
      <Stack.Protected guard={canBrowse}>
        <Stack.Screen name="index" options={{ title: 'Stocks', headerRight: () => <KeyButton /> }} />
        <Stack.Screen name="stock/[symbol]" options={{ title: 'Details' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={navigationTheme(scheme === 'dark' ? 'dark' : 'light', { DarkTheme, DefaultTheme })}>
      <AppQueryProvider>
        <KeyProvider>
          <Routes />
        </KeyProvider>
      </AppQueryProvider>
    </ThemeProvider>
  );
}
