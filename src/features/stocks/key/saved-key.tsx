import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createClient } from '../api/client';
import { apiQueue } from '../api/queue';
import type { KeyStatus } from '../types';
import { monoFont, typeScale, usePalette } from '@/shared/theme';
import { formatCompactNumber } from '@/shared/format';

type Props = { apiKey: string; onReplace: () => void; onRemove: () => void };

/** Shows the prefix from `/v1/usage`, never the key itself. */
export function SavedKey({ apiKey, onReplace, onRemove }: Props) {
  const c = usePalette();
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    createClient(apiKey, apiQueue)
      .usage()
      .then(
        (s) => live && setStatus(s),
        () => live && setFailed(true),
      );
    return () => {
      live = false;
    };
  }, [apiKey]);

  const remaining =
    status?.remainingToday === undefined ? 'Not available' : formatCompactNumber(status.remainingToday);

  return (
    <ScrollView
      style={{ backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: c.text }]}>Your API key</Text>
      {status ? (
        <View style={[styles.card, { backgroundColor: c.surface }]}>
          <Item label="Key" value={`${status.keyPrefix}…`} mono />
          <Item label="Plan" value={status.plan} />
          <Item label="Requests left today" value={remaining} />
        </View>
      ) : failed ? (
        <Text style={[typeScale.body, { color: c.textSecondary }]}>
          Can&apos;t load the key details right now.
        </Text>
      ) : (
        <ActivityIndicator />
      )}
      <Pressable
        onPress={onReplace}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: c.pill.up.bg }]}
      >
        <Text style={[styles.buttonText, { color: c.pill.up.text }]}>Replace key</Text>
      </Pressable>
      <Pressable onPress={onRemove} accessibilityRole="button" style={styles.button}>
        <Text style={[styles.buttonText, { color: c.down }]}>Remove key</Text>
      </Pressable>
    </ScrollView>
  );
}

function Item({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const c = usePalette();
  return (
    <View style={styles.item}>
      <Text style={[typeScale.body, { color: c.textSecondary }]}>{label}</Text>
      <Text style={[typeScale.body, { color: c.text }, mono && { fontFamily: monoFont }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 14 },
  title: { fontSize: 24, fontWeight: '600' },
  card: { borderRadius: 10, padding: 16, gap: 10 },
  item: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', minHeight: 48 },
  buttonText: { fontSize: 17, fontWeight: '600' },
});
