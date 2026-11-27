import { Pressable, StyleSheet, Text } from 'react-native';

import { formatCompactCurrency, formatPercent, formatSignedCurrency } from '@/shared/format';
import { typeScale, usePalette } from '@/shared/theme';
import type { StockSummary } from '../types';

export type PillMode = 'pct' | 'abs' | 'cap';

/** % change, then R$ change, then approximate market cap, then back to % change. */
export const nextPillMode = (m: PillMode): PillMode => (m === 'pct' ? 'abs' : m === 'abs' ? 'cap' : 'pct');

export function pillText(mode: PillMode, s: StockSummary): string {
  if (mode === 'pct') return s.changePct === undefined ? '' : formatPercent(s.changePct);
  if (mode === 'abs') return s.change === undefined ? '' : formatSignedCurrency(s.change);
  return s.marketCap === undefined ? '' : formatCompactCurrency(s.marketCap);
}

/** Green when the change is 0 or more, red otherwise. Empty-styled when there is nothing to show. */
export function ChangePill({
  mode,
  summary,
  onPress,
}: {
  mode: PillMode;
  summary: StockSummary;
  onPress: () => void;
}) {
  const c = usePalette();
  const text = pillText(mode, summary);
  const tone = (summary.change ?? 0) >= 0 ? c.pill.up : c.pill.down;
  const empty = text === '' || summary.change === undefined;
  const bg = empty ? c.surface : tone.bg;
  return (
    <Pressable
      testID="change-pill"
      onPress={onPress}
      hitSlop={6}
      style={[styles.pill, { backgroundColor: bg }]}
      accessibilityRole="button"
      accessibilityLabel="Change display"
    >
      <Text style={[styles.text, { color: empty ? c.textSecondary : tone.text }]} numberOfLines={1}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { minWidth: 76, minHeight: 26, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignItems: 'center' },
  text: { fontSize: typeScale.body.fontSize - 1, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
