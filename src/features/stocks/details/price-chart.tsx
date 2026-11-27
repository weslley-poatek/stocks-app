import { Line as SkiaLine, vec } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { runOnJS, useAnimatedReaction, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { CartesianChart, Line, useChartPressState } from 'victory-native';

import type { ChartSummary } from '../derive';
import { nearestBarIndex } from '../scrub';
import type { Bar } from '../types';
import { chartLabel } from './labels';

type Props = {
  series: readonly Bar[];
  summary: ChartSummary | undefined;
  color: string;
  cursorColor: string;
  /** Colour of the chart's grid lines. */
  gridColor: string;
  /** The plotted bar under the finger, or null once released. Called only when the bar changes. */
  onScrub?: (index: number | null) => void;
};

function Cursor({ x, top, bottom, color }: { x: SharedValue<number>; top: number; bottom: number; color: string }) {
  const p1 = useDerivedValue(() => vec(x.value, top));
  const p2 = useDerivedValue(() => vec(x.value, bottom));
  return <SkiaLine p1={p1} p2={p2} color={color} strokeWidth={1} />;
}

/** The close line for a range: coloured by direction, animated between ranges, scrubbable. */
function PriceChartView({ series, summary, color, cursorColor, gridColor, onScrub }: Props) {
  const { state, isActive } = useChartPressState({ x: 0, y: { y: 0 } });
  const data = useMemo(() => series.map((b) => ({ x: b.t, y: b.close })), [series]);
  const times = useMemo(() => series.map((b) => b.t), [series]);

  const emit = useCallback(
    (index: number) => {
      if (index >= 0) Haptics.selectionAsync().catch(() => {});
      onScrub?.(index >= 0 ? index : null);
    },
    [onScrub],
  );

  // The bar index is computed on the UI thread, and crosses to JS only when it changes (D12).
  useAnimatedReaction(
    () => (state.isActive.value ? nearestBarIndex(times, state.x.value.value) : -1),
    (index, previous) => {
      if (index === previous || (previous === null && index === -1)) return;
      runOnJS(emit)(index);
    },
    [times, emit],
  );

  return (
    <View
      style={styles.chart}
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary ? chartLabel(summary) : undefined}
    >
      {data.length > 1 ? (
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={['y']}
          chartPressState={state}
          domainPadding={{ top: 8, bottom: 8 }}
          axisOptions={{ lineColor: gridColor, lineWidth: 1, tickCount: { x: 0, y: 4 }, labelColor: 'transparent' }}
          frame={{ lineWidth: 0 }}
        >
          {({ points, chartBounds }) => (
            <>
              <Line points={points.y} color={color} strokeWidth={2} animate={{ type: 'timing', duration: 250 }} />
              {isActive ? (
                <Cursor x={state.x.position} top={chartBounds.top} bottom={chartBounds.bottom} color={cursorColor} />
              ) : null}
            </>
          )}
        </CartesianChart>
      ) : null}
    </View>
  );
}

/** Memoized, so a scrub step on the details screen leaves it alone. */
export const PriceChart = memo(PriceChartView);

const styles = StyleSheet.create({ chart: { height: 220 } });
