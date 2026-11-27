import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { createClient } from '../api/client';
import { isApiError } from '../api/client-error';
import { monoFont, typeScale, usePalette } from '@/shared/theme';

export const DASHBOARD_URL = 'https://www.investingdata.com.br/dashboard';

export function failureMessage(e: unknown): { text: string; retry: boolean } {
  if (isApiError(e, 'unauthorized')) {
    return { text: "That key wasn't accepted", retry: false };
  }
  if (isApiError(e, 'forbidden')) {
    return { text: "This key's plan doesn't include price data", retry: false };
  }
  return { text: "Can't check the key right now", retry: true };
}

type Props = {
  /** A message to show before any check, such as "That key was rejected". */
  initialMessage?: string;
  /** Runs after the check succeeds. The key is saved only here. */
  onChecked: (key: string) => Promise<void>;
  onCancel?: () => void;
};

export function KeyEntry({ initialMessage, onChecked, onCancel }: Props) {
  const c = usePalette();
  const [value, setValue] = useState('');
  const [shown, setShown] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ text: string; retry: boolean } | null>(
    initialMessage ? { text: initialMessage, retry: false } : null,
  );

  async function check() {
    const key = value.trim();
    if (!key || checking) return;
    setChecking(true);
    setMessage(null);
    try {
      // Not through the shared queue: a 429 must fail fast, not wait out its 60 s pauses.
      await createClient(key).usage();
    } catch (e) {
      setMessage(failureMessage(e));
      setChecking(false);
      return;
    }
    try {
      await onChecked(key);
    } catch {
      setMessage({ text: "Couldn't save the key", retry: false });
      setChecking(false);
    }
  }

  async function paste() {
    try {
      const text = await Clipboard.getStringAsync();
      if (text) setValue(text.trim());
    } catch {
      // nothing to paste
    }
  }

  const link = { color: c.up, ...typeScale.body } as const;
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>Connect InvestingData</Text>
      <Text style={[typeScale.body, { color: c.textSecondary }]}>
        Paste your API key to load B3 prices.
      </Text>
      <View
        style={[
          styles.field,
          { borderColor: c.separator, backgroundColor: c.surface, opacity: checking ? 0.5 : 1 },
        ]}
      >
        <TextInput
          style={[styles.input, { color: c.text, fontFamily: monoFont }]}
          value={value}
          onChangeText={setValue}
          editable={!checking}
          secureTextEntry={!shown}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="idk_..."
          placeholderTextColor={c.textSecondary}
          accessibilityLabel="API key"
        />
        <Pressable
          onPress={() => setShown((s) => !s)}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel={shown ? 'Hide key' : 'Show key'}
          hitSlop={8}
        >
          <Text style={link}>{shown ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <Pressable
          onPress={paste}
          disabled={checking}
          accessibilityRole="button"
          accessibilityLabel="Paste"
          hitSlop={8}
        >
          <Text style={link}>Paste</Text>
        </Pressable>
      </View>
      {message ? (
        <View style={styles.row}>
          <Text accessibilityRole="alert" style={[typeScale.body, { color: c.down }]}>
            {message.text}
          </Text>
          {message.retry ? (
            <Pressable onPress={check} accessibilityRole="button" accessibilityLabel="Retry">
              <Text style={link}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Pressable
        onPress={check}
        disabled={checking || !value.trim()}
        accessibilityRole="button"
        accessibilityLabel="Continue"
        accessibilityState={{ busy: checking, disabled: checking || !value.trim() }}
        style={[
          styles.button,
          { backgroundColor: c.pill.up.bg, opacity: checking || !value.trim() ? 0.6 : 1 },
        ]}
      >
        {checking ? (
          <ActivityIndicator color={c.pill.up.text} testID="checking-spinner" />
        ) : (
          <Text style={[styles.buttonText, { color: c.pill.up.text }]}>Continue</Text>
        )}
      </Pressable>
      {onCancel ? (
        <Pressable onPress={onCancel} accessibilityRole="button" disabled={checking}>
          <Text style={[link, styles.center]}>Cancel</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => WebBrowser.openBrowserAsync(DASHBOARD_URL)}
        accessibilityRole="link"
      >
        <Text style={[link, styles.center]}>Don&apos;t have a key? Get one</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 14, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  input: { flex: 1, paddingVertical: 12, fontSize: 15 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', flexWrap: 'wrap' },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  center: { textAlign: 'center' },
});
