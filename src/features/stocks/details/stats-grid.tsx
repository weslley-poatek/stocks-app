import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
} from '@/shared/format';
import { typeScale, usePalette } from '@/shared/theme';
import type { StockDetails } from '../types';

export type DividendState = 'loading' | 'forbidden' | 'ready' | 'unavailable';

type Cell = { label: string; value?: string; skeleton?: boolean };

export function statCells(d: StockDetails, dividends: DividendState): Cell[] {
  const money = (v: number | undefined) => (v === undefined ? undefined : formatCurrency(v));
  const count = (v: number | undefined) => (v === undefined ? undefined : formatCompactNumber(v));
  const cells: Cell[] = [
    { label: 'Open', value: money(d.open) },
    { label: 'High', value: money(d.high) },
    { label: 'Low', value: money(d.low) },
    { label: 'Volume (last session)', value: count(d.volume) },
    { label: 'Avg volume (30 sessions)', value: count(d.avgVolume) },
    { label: '52W high', value: money(d.high52w) },
    { label: '52W low', value: money(d.low52w) },
    { label: 'Market cap (approx.)', value: d.marketCap === undefined ? undefined : formatCompactCurrency(d.marketCap) },
  ];
  if (dividends === 'loading') cells.push({ label: 'Dividend yield (TTM)', skeleton: true });
  else if (dividends === 'forbidden') cells.push({ label: 'Dividend yield (TTM)', value: 'Not included in your plan' });
  else if (dividends === 'ready' && d.dividendYield !== undefined) {
    cells.push({ label: 'Dividend yield (TTM)', value: formatPercent(d.dividendYield, { signed: false }) });
  }
  // A stat that can't be derived is hidden, not shown as a placeholder.
  return cells.filter((cell) => cell.skeleton || cell.value !== undefined);
}

function StatsGridView({ details, dividends }: { details: StockDetails; dividends: DividendState }) {
  const c = usePalette();
  const cells = statCells(details, dividends);
  return (
    <View style={styles.grid}>
      {cells.map((cell) => (
        <View key={cell.label} style={styles.cell} accessible accessibilityLabel={cell.skeleton ? `${cell.label}, loading` : `${cell.label}, ${cell.value}`}>
          <Text style={[styles.label, { color: c.textSecondary }]}>{cell.label}</Text>
          {cell.skeleton ? (
            <View testID="dividend-skeleton" style={[styles.skeleton, { backgroundColor: c.surface }]} />
          ) : (
            <Text style={[styles.value, { color: c.text }]}>{cell.value}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

/** Memoized, so a scrub step on the details screen leaves it alone. */
export const StatsGrid = memo(StatsGridView);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  cell: { width: '50%', gap: 2, paddingRight: 12 },
  label: { ...typeScale.caption },
  value: { ...typeScale.body, fontWeight: '600' },
  skeleton: { height: 18, width: 64, borderRadius: 4, marginTop: 2 },
});
