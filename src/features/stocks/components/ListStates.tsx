import { Pressable, StyleSheet, Text, View } from 'react-native';

import { typeScale, usePalette } from '@/shared/theme';

export function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  const c = usePalette();
  return (
    <View testID="error-banner" style={[styles.banner, { backgroundColor: c.surface }]}>
      <Text accessibilityRole="alert" style={[typeScale.body, styles.flex, { color: c.text }]}>
        Couldn&apos;t refresh prices
      </Text>
      <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry" hitSlop={8}>
        <Text style={[typeScale.body, { color: c.up, fontWeight: '600' }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

export function EmptySearch({ query }: { query: string }) {
  const c = usePalette();
  return (
    <Text style={[typeScale.body, styles.empty, { color: c.textSecondary }]}>
      {`No results for "${query}"`}
    </Text>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginHorizontal: 16, marginVertical: 8, borderRadius: 10 },
  flex: { flex: 1 },
  empty: { textAlign: 'center', padding: 32 },
});
