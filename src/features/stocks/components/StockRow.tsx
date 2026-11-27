import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCurrency, formatDecimal } from '@/shared/format';
import { typeScale, usePalette } from '@/shared/theme';
import type { RowData } from '../row-data';
import { ChangePill, type PillMode } from './ChangePill';
import { CompanyLogo } from './CompanyLogo';
import { Sparkline } from './Sparkline';

type Props = {
  row: RowData;
  /** True while the price history is on its way: the right side shows placeholders. */
  loading?: boolean;
  mode: PillMode;
  onCycleMode: () => void;
  onOpen: (symbol: string) => void;
};

/** "up 1.2 percent": one reading for a screen reader, with no more digits than needed. */
function changeWords(changePct: number | undefined): string | undefined {
  if (changePct === undefined) return undefined;
  const amount = formatDecimal(Math.abs(changePct) * 100, 2);
  return `${changePct >= 0 ? 'up' : 'down'} ${amount} percent`;
}

export function rowLabel(row: RowData, loading = false): string {
  const parts: (string | undefined)[] = [row.symbol, row.name];
  if (row.summary) {
    parts.push(formatCurrency(row.summary.close), changeWords(row.summary.changePct));
  } else if (loading) parts.push('loading');
  return parts.filter(Boolean).join(', ');
}

function StockRowView({ row, loading = false, mode, onCycleMode, onOpen }: Props) {
  const c = usePalette();
  const { summary, spark } = row;
  return (
    <Pressable
      testID={`row-${row.symbol}`}
      onPress={() => onOpen(row.symbol)}
      accessible
      accessibilityRole="button"
      accessibilityLabel={rowLabel(row, loading)}
      accessibilityActions={summary ? [{ name: 'cycle', label: 'Change display' }] : undefined}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'cycle' && onCycleMode()}
      style={[styles.row, { borderBottomColor: c.separator }]}
    >
      <CompanyLogo symbol={row.symbol} uri={row.logoUrl} size={36} />
      <View style={styles.left}>
        <Text style={[typeScale.ticker, { color: c.text }]} numberOfLines={1}>
          {row.symbol}
        </Text>
        {row.name ? (
          <Text style={[typeScale.name, { color: c.textSecondary }]} numberOfLines={1}>
            {row.name}
          </Text>
        ) : null}
      </View>
      {spark ? <Sparkline points={spark.points} direction={spark.direction} /> : null}
      {summary ? (
        <View style={styles.right}>
          <Text style={[styles.close, { color: c.text }]}>{formatCurrency(summary.close)}</Text>
          <ChangePill mode={mode} summary={summary} onPress={onCycleMode} />
        </View>
      ) : loading ? (
        <PriceSkeleton testID="price-skeleton" />
      ) : null}
    </Pressable>
  );
}

export const StockRow = memo(StockRowView);

/** Placeholders for the close and the change pill. */
function PriceSkeleton({ testID }: { testID?: string }) {
  const c = usePalette();
  return (
    <View style={styles.right} testID={testID}>
      <View style={[styles.block, { width: 64, height: 18, backgroundColor: c.surface }]} />
      <View style={[styles.block, { width: 76, height: 26, backgroundColor: c.surface }]} />
    </View>
  );
}

/** A row with nothing known yet: the 8 placeholders shown while the list first loads. */
export function SkeletonRow() {
  const c = usePalette();
  return (
    <View
      testID="skeleton-row"
      style={[styles.row, { borderBottomColor: c.separator }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.left}>
        <View style={[styles.block, { width: 70, height: 17, backgroundColor: c.surface }]} />
        <View style={[styles.block, { width: 120, height: 13, backgroundColor: c.surface }]} />
      </View>
      <PriceSkeleton />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 4 },
  close: { fontSize: typeScale.body.fontSize + 2, fontWeight: '600', fontVariant: ['tabular-nums'] },
  block: { borderRadius: 4 },
});
