import { formatCurrency, formatPercent } from '@/shared/format';
import type { ChartSummary } from '../derive';
import type { Range } from '../types';

export const RANGES: readonly Range[] = ['1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL'];

const RANGE_NAMES: Record<Range, string> = {
  '1W': '1 week',
  '1M': '1 month',
  '3M': '3 months',
  '6M': '6 months',
  YTD: 'year to date',
  '1Y': '1 year',
  '5Y': '5 years',
  ALL: 'all time',
};

export const rangeName = (range: Range): string => RANGE_NAMES[range];

/** "1 month, up 4,3 percent, from R$ 35,10 to R$ 36,61" */
export function chartLabel(s: ChartSummary): string {
  const pct = formatPercent(Math.abs(s.changePct), { signed: false, digits: 1 }).replace(/\s*%/, '');
  return `${rangeName(s.range)}, ${s.direction} ${pct} percent, from ${formatCurrency(s.startClose)} to ${formatCurrency(s.endClose)}`;
}
