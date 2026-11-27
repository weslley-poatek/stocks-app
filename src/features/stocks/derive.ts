// Pure derivations from raw bars and dividends (no React, no I/O).
// Bar timestamps are milliseconds (design D7). Bar dates are the UTC calendar date of the
// timestamp: B3 history bars are stamped at 00:00 UTC for the session day (see the fixtures and
// the spec's "Seconds" scenario, which reads 1764028800 as 2025-11-25 UTC). Converting to
// America/Sao_Paulo would move every bar to the previous evening, so all calendar maths is UTC.
import type { Bar, Dividend, Range } from './types';

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` (UTC) of a timestamp in milliseconds. */
export function dateOf(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

export type Quote = { close: number; change?: number; changePct?: number; asOf: string };

/** Last close, change and change % against the previous bar, and the session date. */
export function quote(bars: readonly Bar[]): Quote | undefined {
  const lastBar = last(bars);
  if (!lastBar) return undefined;
  const result: Quote = { close: lastBar.close, asOf: dateOf(lastBar.t) };
  const prev = bars[bars.length - 2];
  if (prev) {
    result.change = lastBar.close - prev.close;
    if (prev.close !== 0) result.changePct = result.change / prev.close;
  }
  return result;
}

export type Direction = 'up' | 'down';

export function directionOf(first: number, lastClose: number): Direction {
  return lastClose >= first ? 'up' : 'down';
}

/** The last 5 closes, marked up when the last is at or above the first. */
export function sparkline(bars: readonly Bar[]): { points: number[]; direction: Direction } | undefined {
  const points = bars.slice(-5).map((b) => b.close);
  if (points.length === 0) return undefined;
  return { points, direction: directionOf(points[0], points[points.length - 1]) };
}

const RANGE_MONTHS: Partial<Record<Range, number>> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12, '5Y': 60 };

function shiftMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const daysInTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, daysInTarget));
  return target.toISOString().slice(0, 10);
}

function shiftDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The bars of a range, ending at the last bar. Every bar is kept (no downsampling). */
export function sliceRange(bars: readonly Bar[], range: Range): Bar[] {
  const lastBar = last(bars);
  if (!lastBar) return [];
  if (range === 'ALL') return [...bars];
  const lastDate = dateOf(lastBar.t);
  let start: string;
  if (range === 'YTD') start = `${lastDate.slice(0, 4)}-01-01`;
  else if (range === '1W') start = shiftDays(lastDate, -7);
  else start = shiftMonths(lastDate, RANGE_MONTHS[range] as number);
  const from = Date.parse(`${start}T00:00:00Z`);
  return bars.filter((b) => b.t >= from);
}

export const MAX_CHART_POINTS = 500;

/** Monday-based week index since the epoch (1970-01-01 was a Thursday). */
function weekIndex(t: number): number {
  return Math.floor((Math.floor(t / DAY_MS) + 3) / 7);
}

/** Keeps the last bar of each ISO week, widening the bucket until at most `max` points remain. */
export function downsample(bars: readonly Bar[], max: number = MAX_CHART_POINTS): Bar[] {
  let width = 1;
  for (;;) {
    const out: Bar[] = [];
    let currentBucket: number | undefined;
    for (const bar of bars) {
      const bucket = Math.floor(weekIndex(bar.t) / width);
      if (bucket === currentBucket) out[out.length - 1] = bar;
      else {
        out.push(bar);
        currentBucket = bucket;
      }
    }
    if (out.length <= max) return out;
    width += 1;
  }
}

/** The bars to draw for a range: 5Y and ALL are downsampled, shorter ranges keep every bar. */
export function chartSeries(bars: readonly Bar[], range: Range): Bar[] {
  const slice = sliceRange(bars, range);
  return range === '5Y' || range === 'ALL' ? downsample(slice) : slice;
}

export type ChartSummary = {
  range: Range;
  direction: Direction;
  changePct: number;
  startClose: number;
  endClose: number;
};

/** Range, direction, % and start and end close, for the chart's accessibility label. */
export function chartSummary(bars: readonly Bar[], range: Range): ChartSummary | undefined {
  const slice = sliceRange(bars, range);
  const first = slice[0];
  const lastBar = last(slice);
  if (!first || !lastBar) return undefined;
  return {
    range,
    direction: directionOf(first.close, lastBar.close),
    changePct: first.close !== 0 ? (lastBar.close - first.close) / first.close : 0,
    startClose: first.close,
    endClose: lastBar.close,
  };
}

export type SessionStats = { open?: number; high?: number; low?: number; volume?: number };

/** Open, high, low and volume of the last bar; a missing field is absent. */
export function sessionStats(bars: readonly Bar[]): SessionStats {
  const b = last(bars);
  if (!b) return {};
  const stats: SessionStats = {};
  if (b.open !== undefined) stats.open = b.open;
  if (b.high !== undefined) stats.high = b.high;
  if (b.low !== undefined) stats.low = b.low;
  if (b.volume !== undefined) stats.volume = b.volume;
  return stats;
}

/** A bar is daily when it is at most 5 days after the bar before it (design D16). */
const DAILY_GAP_MS = 5 * DAY_MS;

/** Mean volume of the last 30 daily bars (never a monthly one), over those with a volume. */
export function avgVolume(bars: readonly Bar[]): number | undefined {
  const daily = bars.filter((b, i) => i > 0 && b.t - bars[i - 1].t <= DAILY_GAP_MS).slice(-30);
  const volumes = daily.flatMap((b) => (b.volume === undefined ? [] : [b.volume]));
  if (volumes.length === 0) return undefined;
  return volumes.reduce((a, b) => a + b, 0) / volumes.length;
}

/** Highest high and lowest low over the bars dated within 365 days of the last bar. */
export function range52w(bars: readonly Bar[]): { high52w?: number; low52w?: number } {
  const lastBar = last(bars);
  if (!lastBar) return {};
  const from = lastBar.t - 365 * DAY_MS;
  const window = bars.filter((b) => b.t >= from);
  const highs = window.flatMap((b) => (b.high === undefined ? [] : [b.high]));
  const lows = window.flatMap((b) => (b.low === undefined ? [] : [b.low]));
  const out: { high52w?: number; low52w?: number } = {};
  if (highs.length) out.high52w = Math.max(...highs);
  if (lows.length) out.low52w = Math.min(...lows);
  return out;
}

/** Approximate market cap: last close times total shares (which mixes share classes). */
export function marketCap(close: number | undefined, totalShares: number | undefined): number | undefined {
  if (close === undefined || totalShares === undefined || totalShares <= 0) return undefined;
  return close * totalShares;
}

/**
 * Trailing dividend yield as a fraction: payouts with an ex-date after (last date - 12 months)
 * and up to the last date, over the last close. Absent while dividends are unknown (`undefined`).
 */
export function dividendYield(
  bars: readonly Bar[],
  dividends: readonly Dividend[] | undefined,
): number | undefined {
  const lastBar = last(bars);
  if (!lastBar || !dividends || lastBar.close <= 0) return undefined;
  const lastDate = dateOf(lastBar.t);
  const start = shiftMonths(lastDate, 12);
  const total = dividends
    .filter((d) => d.exDate > start && d.exDate <= lastDate)
    .reduce((sum, d) => sum + d.amount, 0);
  return total / lastBar.close;
}
