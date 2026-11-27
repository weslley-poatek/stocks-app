import {
  avgVolume,
  chartSeries,
  chartSummary,
  dateOf,
  dividendYield,
  downsample,
  marketCap,
  quote,
  range52w,
  sessionStats,
  sliceRange,
  sparkline,
} from './derive';
import { mapBars, toMs } from './api/mappers';
import type { Bar } from './types';

const DAY = 86_400_000;
const LAST = Date.UTC(2025, 10, 25); // 2025-11-25 00:00 UTC

/** One bar per calendar day (weekends included, which is fine for slicing), ending at `end`. */
function daily(count: number, end = LAST, close = (i: number) => 10 + i): Bar[] {
  return Array.from({ length: count }, (_, i) => ({ t: end - (count - 1 - i) * DAY, close: close(i) }));
}

describe('timestamp units', () => {
  // Bars are normalized to milliseconds when mapped (design D7), so derive code reads only milliseconds.
  const dateOfRaw = (timestamp: number) => dateOf(mapBars([{ timestamp, close: 1 }])[0].t);
  it('Seconds', () => expect(dateOfRaw(1764028800)).toBe('2025-11-25'));
  it('Milliseconds', () => expect(dateOfRaw(1764028800000)).toBe('2025-11-25'));
  it('toMs', () => {
    expect(toMs(1764028800)).toBe(1764028800000);
    expect(toMs(1764028800000)).toBe(1764028800000);
  });
});

describe('quote', () => {
  it('Up day', () => {
    const q = quote([
      { t: LAST - DAY, close: 36.61 },
      { t: LAST, close: 37.05 },
    ])!;
    expect(q.close).toBe(37.05);
    expect(q.change).toBeCloseTo(0.44, 10);
    expect(q.changePct).toBeCloseTo(0.012, 3);
    expect(q.asOf).toBe('2025-11-25');
  });
  it('Single bar', () => {
    const q = quote([{ t: LAST, close: 37.05 }])!;
    expect(q.close).toBe(37.05);
    expect(q.change).toBeUndefined();
    expect(q.changePct).toBeUndefined();
  });
  it('is absent for no bars', () => expect(quote([])).toBeUndefined());
});

describe('sparkline', () => {
  it('Down week', () => {
    const bars = daily(8, LAST, (i) => [40, 39, 38, 37.5, 37, 36.8, 36.6, 36.5][i]).map((b, i) =>
      i === 3 ? { ...b, close: 38 } : b,
    );
    const s = sparkline(bars)!;
    expect(s.points).toHaveLength(5);
    expect(s.points[0]).toBe(38);
    expect(s.points[4]).toBe(36.5);
    expect(s.direction).toBe('down');
  });
  it('is up when the last equals the first', () => {
    expect(sparkline(daily(5, LAST, () => 5))!.direction).toBe('up');
  });
});

describe('range slices', () => {
  const bars = daily(800);
  it('One month', () => {
    const slice = sliceRange(bars, '1M');
    expect(dateOf(slice[0].t)).toBe('2025-10-25');
    expect(slice[slice.length - 1]).toBe(bars[bars.length - 1]);
    expect(slice).toHaveLength(32);
  });
  it('1W starts 7 days back', () => expect(dateOf(sliceRange(bars, '1W')[0].t)).toBe('2025-11-18'));
  it('3M, 6M and 1Y start that many months back', () => {
    expect(dateOf(sliceRange(bars, '3M')[0].t)).toBe('2025-08-25');
    expect(dateOf(sliceRange(bars, '6M')[0].t)).toBe('2025-05-25');
    expect(dateOf(sliceRange(bars, '1Y')[0].t)).toBe('2024-11-25');
  });
  it('YTD starts at the first bar of the last bar calendar year', () => {
    const slice = sliceRange(bars, 'YTD');
    expect(dateOf(slice[0].t)).toBe('2025-01-01');
  });
  it('YTD starts at the first bar present when January 1 has none', () => {
    const sparse: Bar[] = [
      { t: Date.UTC(2024, 11, 30), close: 1 },
      { t: Date.UTC(2025, 0, 2), close: 2 },
      { t: Date.UTC(2025, 0, 3), close: 3 },
    ];
    expect(sliceRange(sparse, 'YTD')).toHaveLength(2);
  });
  it('clamps month ends (Mar 31 minus 1M is Feb 28)', () => {
    const b = daily(100, Date.UTC(2025, 2, 31));
    expect(dateOf(sliceRange(b, '1M')[0].t)).toBe('2025-02-28');
  });
  it('Range longer than history', () => {
    const two = daily(730);
    expect(sliceRange(two, '5Y')).toHaveLength(730);
  });
  it('ALL is the whole history; empty is empty', () => {
    expect(sliceRange(bars, 'ALL')).toHaveLength(800);
    expect(sliceRange([], '1M')).toEqual([]);
  });
});

describe('downsampling', () => {
  it('Five years', () => {
    const bars = daily(7 * 365 + 1);
    const series = chartSeries(bars, '5Y');
    expect(series.length).toBeGreaterThan(255);
    expect(series.length).toBeLessThan(270);
    expect(series[series.length - 1].close).toBe(bars[bars.length - 1].close);
  });
  it('Twenty years', () => {
    // 5,000 weekday-like bars (about 20 years): weekly points would be about 1,000.
    const bars: Bar[] = Array.from({ length: 5000 }, (_, i) => ({
      t: Date.UTC(2005, 0, 3) + Math.floor(i / 5) * 7 * DAY + (i % 5) * DAY,
      close: i,
    }));
    expect(downsample(bars, 5000).length).toBeGreaterThan(900);
    const series = chartSeries(bars, 'ALL');
    expect(series.length).toBeLessThanOrEqual(500);
    expect(series[series.length - 1].close).toBe(4999);
  });
  it('shorter ranges keep every bar', () => {
    expect(chartSeries(daily(800), '1Y')).toHaveLength(366);
  });
});

describe('chart summary', () => {
  it('describes an up range', () => {
    const s = chartSummary(daily(60, LAST, (i) => 10 + i), '1M')!;
    expect(s.range).toBe('1M');
    expect(s.direction).toBe('up');
    expect(s.endClose).toBe(69);
    expect(s.startClose).toBe(38);
    expect(s.changePct).toBeCloseTo((69 - 38) / 38, 10);
  });
  it('describes a down range', () => {
    const s = chartSummary(daily(60, LAST, (i) => 100 - i), '1M')!;
    expect(s.direction).toBe('down');
    expect(s.changePct).toBeLessThan(0);
  });
  it('is absent for no bars', () => expect(chartSummary([], '1M')).toBeUndefined());
});

describe('session stats', () => {
  it('reads the last bar', () => {
    const bars: Bar[] = [{ t: LAST, close: 1, open: 2, high: 3, low: 0.5, volume: 100 }];
    expect(sessionStats(bars)).toEqual({ open: 2, high: 3, low: 0.5, volume: 100 });
  });
  it('Missing volume', () => {
    const s = sessionStats([{ t: LAST, close: 1, open: 1, high: 1, low: 1 }]);
    expect(s.volume).toBeUndefined();
    expect('volume' in s).toBe(false);
  });
  it('Short history', () => {
    const bars: Bar[] = Array.from({ length: 100 }, (_, i) => ({
      t: LAST - (99 - i) * DAY,
      close: 10,
      high: 20 + i,
      low: 5 + (i === 0 ? -3 : i),
      volume: i < 70 ? 1_000_000 : 100,
    }));
    expect(range52w(bars)).toEqual({ high52w: 119, low52w: 2 });
    expect(avgVolume(bars)).toBe(100);
  });
  it('52W uses only bars within 365 days of the last bar', () => {
    const bars: Bar[] = Array.from({ length: 400 }, (_, i) => ({
      t: LAST - (399 - i) * DAY,
      close: 10,
      high: i === 10 ? 999 : 20,
      low: 5,
    }));
    expect(range52w(bars).high52w).toBe(20);
  });
  it('averages only the last 30 volumes', () => {
    const bars: Bar[] = Array.from({ length: 40 }, (_, i) => ({ t: LAST - (39 - i) * DAY, close: 1, volume: i < 10 ? 1e9 : 10 }));
    expect(avgVolume(bars)).toBe(10);
  });
  describe('Monthly then daily history', () => {
    // D16: monthly bars 2016-12 to 2026-07, then daily bars from 2026-08-03 to 2026-10-30.
    const bars: Bar[] = [];
    for (let m = 0; m < 116; m++) {
      bars.push({ t: Date.UTC(2016, 11 + m, 1), close: 10, high: 500 - m, low: 1, volume: 1e9 });
    }
    // The 2025-10-01 monthly bar is outside the window; 2025-11-03 is the first inside.
    for (let d = Date.UTC(2026, 7, 3); d <= Date.UTC(2026, 9, 30); d += DAY) {
      const wd = new Date(d).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      bars.push({ t: d, close: 10, high: 20, low: 8, volume: 100 });
    }
    it('averages only daily volumes', () => {
      expect(avgVolume(bars)).toBe(100);
    });
    it('uses only bars dated from 30 October 2025 on for 52W', () => {
      const r = range52w(bars);
      // Monthly bars before 2025-10-30 had huge highs; 2025-11-01 is the first monthly bar inside.
      const first = bars.find((b) => b.t >= Date.UTC(2025, 9, 30))!;
      expect(dateOf(first.t)).toBe('2025-11-01');
      expect(r.high52w).toBe(first.high);
      expect(r.low52w).toBe(1);
      const outside = bars.filter((b) => b.t < Date.UTC(2025, 9, 30));
      expect(Math.max(...outside.map((b) => b.high!))).toBeGreaterThan(r.high52w!);
    });
    it('includes a bar exactly 365 days before the last bar', () => {
      const edge: Bar[] = [
        { t: Date.UTC(2025, 9, 30), close: 1, high: 50 },
        { t: Date.UTC(2026, 9, 30), close: 1, high: 5 },
      ];
      expect(range52w(edge).high52w).toBe(50);
    });
  });
  it('is absent without volumes or highs and lows', () => {
    const bars = daily(5);
    expect(avgVolume(bars)).toBeUndefined();
    expect(range52w(bars)).toEqual({});
  });
});

describe('market cap', () => {
  it('Known shares', () => {
    const cap = marketCap(37.85, 13_044_496_930)!;
    expect(cap / 1e9).toBeCloseTo(493.7, 1);
  });
  it('Unknown shares', () => {
    expect(marketCap(37.85, undefined)).toBeUndefined();
    expect(marketCap(37.85, 0)).toBeUndefined();
  });
});

describe('dividend yield', () => {
  const bars: Bar[] = [{ t: LAST, close: 37 }];
  it('Four payouts', () => {
    const y = dividendYield(bars, [
      { exDate: '2025-02-10', amount: 1 },
      { exDate: '2025-05-10', amount: 0.9 },
      { exDate: '2025-08-10', amount: 0.9 },
      { exDate: '2025-11-10', amount: 0.9 },
      { exDate: '2024-11-25', amount: 5 }, // exactly 12 months back: outside
      { exDate: '2024-06-01', amount: 5 },
      { exDate: '2025-12-01', amount: 5 }, // after the last bar: outside
    ])!;
    expect(y).toBeCloseTo(0.1, 10);
  });
  it('No payouts', () => expect(dividendYield(bars, [])).toBe(0));
  it('is absent while dividends are unknown', () => expect(dividendYield(bars, undefined)).toBeUndefined());
});
