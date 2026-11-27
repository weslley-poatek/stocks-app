// Pure helpers for chart scrubbing (design D12). `nearestBarIndex` runs as a worklet on the UI
// thread, so it must stay free of closures.
import { quote, type Quote } from './derive';
import type { Bar } from './types';

/** The index of the time nearest `t`, among ascending `times`. -1 when there are none. */
export function nearestBarIndex(times: readonly number[], t: number): number {
  'worklet';
  const n = times.length;
  if (n === 0) return -1;
  if (t <= times[0]) return 0;
  if (t >= times[n - 1]) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  return t - times[lo] <= times[hi] - t ? lo : hi;
}

/** Close, change against the bar before it, and date of one plotted bar. */
export function scrubQuote(bars: readonly Bar[], bar: Bar): Quote {
  const i = bars.findIndex((b) => b.t === bar.t);
  const upTo = i >= 0 ? bars.slice(Math.max(0, i - 1), i + 1) : [bar];
  return quote(upTo) as Quote;
}
