import { StyleSheet, View } from 'react-native';

import type { Direction } from '../derive';
import { usePalette } from '@/shared/theme';

const WIDTH = 56;
const HEIGHT = 24;
const THICKNESS = 2;

/** A line through the last closes, drawn with rotated Views (no native drawing needed). */
export function Sparkline({ points, direction }: { points: readonly number[]; direction: Direction }) {
  const c = usePalette();
  const color = direction === 'up' ? c.up : c.down;
  const min = Math.min(...points);
  const span = Math.max(...points) - min;
  const pad = THICKNESS;
  const xy = points.map((p, i) => ({
    x: points.length === 1 ? WIDTH / 2 : (i / (points.length - 1)) * WIDTH,
    y: span === 0 ? HEIGHT / 2 : pad + (1 - (p - min) / span) * (HEIGHT - 2 * pad),
  }));
  const segments =
    xy.length === 1
      ? [{ a: { x: 0, y: xy[0].y }, b: { x: WIDTH, y: xy[0].y } }]
      : xy.slice(1).map((b, i) => ({ a: xy[i], b }));
  return (
    <View testID="sparkline" style={styles.box}>
      {segments.map(({ a, b }, i) => {
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        return (
          <View
            key={i}
            testID="sparkline-segment"
            style={{
              position: 'absolute',
              width: length,
              height: THICKNESS,
              borderRadius: THICKNESS / 2,
              backgroundColor: color,
              left: (a.x + b.x) / 2 - length / 2,
              top: (a.y + b.y) / 2 - THICKNESS / 2,
              transform: [{ rotate: `${Math.atan2(b.y - a.y, b.x - a.x)}rad` }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ box: { width: WIDTH, height: HEIGHT } });
