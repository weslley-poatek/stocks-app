import { StyleSheet, Text, View } from 'react-native';

import { formatCurrency, formatPercent, formatShortDate, formatSignedCurrency } from '@/shared/format';
import { typeScale, usePalette } from '@/shared/theme';
import type { Quote } from '../derive';

/** The close, change and date. While scrubbing, the date stands alone (no "At close"). */
export function PriceBlock({ quote, scrubbing }: { quote: Quote; scrubbing: boolean }) {
  const c = usePalette();
  const { change, changePct } = quote;
  const color = (change ?? 0) >= 0 ? c.up : c.down;
  const date = formatShortDate(quote.asOf);
  return (
    <View style={styles.block}>
      <Text style={[styles.close, { color: c.text }]}>{formatCurrency(quote.close)}</Text>
      {change !== undefined ? (
        <Text style={[styles.change, { color }]}>
          {formatSignedCurrency(change)}
          {changePct !== undefined ? ` (${formatPercent(changePct)})` : ''}
        </Text>
      ) : null}
      <Text style={[styles.date, { color: c.textSecondary }]}>{scrubbing ? date : `At close, ${date}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 2 },
  close: { ...typeScale.close },
  change: { ...typeScale.body, fontWeight: '600' },
  date: { ...typeScale.caption },
});
