import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { typeScale, usePalette } from '@/shared/theme';
import type { Range } from '../types';
import { RANGES, rangeName } from './labels';

type Props = { value: Range; onChange: (range: Range) => void };

/** A segmented control, exposed to screen readers as a tab list. */
function RangeSelectorView({ value, onChange }: Props) {
  const c = usePalette();
  return (
    <View testID="range-selector" accessibilityRole="tablist" style={[styles.row, { backgroundColor: c.surface }]}>
      {RANGES.map((r) => {
        const selected = r === value;
        return (
          <Pressable
            key={r}
            accessibilityRole="tab"
            accessibilityLabel={rangeName(r)}
            accessibilityState={{ selected }}
            onPress={() => onChange(r)}
            hitSlop={{ top: 8, bottom: 8 }}
            style={[styles.tab, selected && { backgroundColor: c.background }]}
          >
            <Text style={[styles.text, { color: selected ? c.text : c.textSecondary }, selected && styles.selected]}>
              {r}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Memoized, so a scrub step on the details screen leaves it alone. */
export const RangeSelector = memo(RangeSelectorView);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 32, borderRadius: 8 },
  text: { ...typeScale.caption },
  selected: { fontWeight: '600' },
});
