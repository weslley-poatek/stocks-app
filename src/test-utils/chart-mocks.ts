// Jest stand-ins for the native chart stack (Skia, victory-native, reanimated, haptics). Import this
// first in a test, so its `jest.mock` calls register before the components load. Tests assert the
// chart's data, colour and labels, and drive scrubbing through `scrub()`; they don't check pixels.
/* eslint-disable @typescript-eslint/no-require-imports */
type Reaction = { prepare: () => number; react: (v: number, prev: number | null) => void; prev: number | null };

type Shared = {
  lines: { color: string; points: unknown[] }[];
  charts: { data: { x: number; y: number }[]; gridColor?: unknown }[];
  reactions: Reaction[];
  press: { active: boolean; x: number };
};

const g = globalThis as unknown as { __chartMock?: Shared };
g.__chartMock ??= { lines: [], charts: [], reactions: [], press: { active: false, x: 0 } };
const shared = g.__chartMock;

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => {}) }));

jest.mock('@shopify/react-native-skia', () => ({ Line: () => null, vec: (x: number, y: number) => ({ x, y }) }));

jest.mock('react-native-reanimated', () => {
  const state = () => (globalThis as unknown as { __chartMock: Shared }).__chartMock;
  return {
    runOnJS: (fn: unknown) => fn,
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    useAnimatedReaction: (prepare: Reaction['prepare'], react: Reaction['react']) => {
      // The latest closures win, as they would after a re-render.
      const list = state().reactions;
      const prev = list[0]?.prev ?? null;
      list.length = 0;
      list.push({ prepare, react, prev });
    },
  };
});

jest.mock('victory-native', () => {
  const React = require('react');
  const { View } = require('react-native');
  const state = () => (globalThis as unknown as { __chartMock: Shared }).__chartMock;
  const value = <T,>(v: T) => ({ value: v });
  return {
    CartesianChart: (props: {
      data: { x: number; y: number }[];
      axisOptions?: { lineColor?: unknown };
      children: (a: unknown) => unknown;
    }) => {
      state().charts.push({ data: props.data, gridColor: props.axisOptions?.lineColor });
      return React.createElement(
        View,
        { testID: 'cartesian-chart' },
        props.children({
          points: { y: props.data.map((d) => ({ x: d.x, y: d.y })) },
          chartBounds: { left: 0, right: 100, top: 0, bottom: 100 },
        }) as never,
      );
    },
    Line: (p: { color: string; points: unknown[] }) => {
      state().lines.push({ color: p.color, points: p.points });
      return null;
    },
    useChartPressState: () => ({
      isActive: false,
      state: {
        isActive: { get value() { return state().press.active; } },
        x: { value: { get value() { return state().press.x; } }, position: value(0) },
        y: { y: { value: value(0), position: value(0) } },
        matchedIndex: value(0),
        yIndex: value(0),
      },
    }),
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

export const chartMock = shared;

export function resetChartMock() {
  shared.lines.length = 0;
  shared.charts.length = 0;
  shared.reactions.length = 0;
  shared.press.active = false;
  shared.press.x = 0;
}

/** Moves the finger to the given time (null lifts it) and runs the chart's UI-thread reaction. */
export function scrub(x: number | null) {
  shared.press.active = x !== null;
  shared.press.x = x ?? 0;
  for (const r of shared.reactions) {
    const v = r.prepare();
    r.react(v, r.prev);
    r.prev = v;
  }
}
