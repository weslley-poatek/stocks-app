import { toStockSummary } from './api/mappers';
import { sparkline, type Direction } from './derive';
import type { Bar, Company, StockSummary } from './types';

/** What a list row shows. `name` is absent for a ticker with no company. */
export type RowData = {
  symbol: string;
  name?: string;
  logoUrl?: string;
  summary?: StockSummary;
  spark?: { points: number[]; direction: Direction };
  volume?: number;
};

export function toRowData(symbol: string, bars: Bar[] | undefined, company?: Company): RowData {
  const base: RowData = { symbol, name: company?.name, logoUrl: company?.logoUrl };
  if (!bars || bars.length === 0) return base;
  const summary = toStockSummary({ symbol, bars, company });
  return { ...base, summary, spark: sparkline(bars), volume: bars[bars.length - 1].volume };
}
