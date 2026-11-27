import type {
  Bar,
  Company,
  Dividend,
  KeyStatus,
  StockDetails,
  StockSummary,
  TickerInfo,
} from '../types';
import type {
  BarDto,
  CompaniesPageDto,
  CompanyDto,
  DividendDto,
  TickerDto,
  UsageDto,
} from './schemas';
import { avgVolume, dateOf, dividendYield, marketCap, quote, range52w, sessionStats } from '../derive';

/** Normalizes a timestamp to milliseconds: above 1e12 is milliseconds, otherwise seconds (design D7). */
export function toMs(t: number): number {
  return t > 1e12 ? t : t * 1000;
}

const opt = <T>(v: T | null | undefined): T | undefined => v ?? undefined;

/** The most of a key that any screen may show (design D16, "Key secrecy"). */
export const KEY_PREFIX_CHARS = 8;

export function mapUsage(dto: UsageDto): KeyStatus {
  const rl = dto.rate_limit;
  return {
    // The real API's `key_prefix` is about 35 characters: cut it here so no screen can show more.
    keyPrefix: dto.key_prefix.slice(0, KEY_PREFIX_CHARS),
    plan: dto.role,
    perMinute: rl?.minute.limit,
    perDay: rl?.day.limit,
    remainingToday: rl?.day.remaining,
    minuteResetsAt: opt(rl?.minute.resets_at),
  };
}

export function mapCompany(dto: CompanyDto): Company {
  return {
    id: dto.id,
    name: dto.display_name,
    legalName: dto.legal_name,
    logoUrl: opt(dto.image_url),
    tickers: dto.tickers,
    totalShares: opt(dto.summary?.total_shares),
    sector: opt(dto.sector),
    subsector: opt(dto.subsector),
    segment: opt(dto.segment),
  };
}

export function mapCompaniesPage(dto: CompaniesPageDto): {
  companies: Company[];
  page: number;
  pageCount: number;
} {
  return {
    companies: dto.data.map(mapCompany),
    page: dto.page,
    pageCount: dto.limit > 0 ? Math.ceil(dto.total / dto.limit) : 0,
  };
}

export function mapTicker(dto: TickerDto): TickerInfo {
  return { symbol: dto.symbol, companyId: opt(dto.company_id) };
}

/** Bars in milliseconds, sorted ascending, one per timestamp (the last one given wins). */
export function mapBars(dtos: BarDto[]): Bar[] {
  const byTime = new Map<number, Bar>();
  for (const d of dtos) {
    const t = toMs(d.timestamp);
    byTime.set(t, {
      t,
      close: d.close,
      open: opt(d.open),
      high: opt(d.high),
      low: opt(d.low),
      volume: opt(d.volume),
      adjusted: opt(d.adjusted),
    });
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t);
}

/**
 * `YYYY-MM-DD` (UTC, like bar dates) from a date, an ISO date-time, or a Unix timestamp in seconds
 * or milliseconds written as digits (what the real API sends, e.g. "1525143600"), else undefined.
 */
export function parseExDate(s: string): string | undefined {
  if (/^\d{9,13}$/.test(s.trim())) return dateOf(toMs(Number(s)));
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(s.trim());
  if (!m) return undefined;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const valid = d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  return valid ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** Payouts with an unparseable ex-date are left out (design D15). Sorted by ex-date, newest first. */
export function mapDividends(dtos: DividendDto[]): Dividend[] {
  const out: Dividend[] = [];
  for (const d of dtos) {
    const exDate = parseExDate(d.ex_date);
    if (exDate) out.push({ exDate, amount: d.amount });
  }
  return out.sort((a, b) => (a.exDate < b.exDate ? 1 : a.exDate > b.exDate ? -1 : 0));
}

type SummaryInput = { symbol: string; bars: Bar[]; company?: Company };

/** Change % and dividend yield are fractions (0.012 is 1.2%); `formatPercent` does the x100. */
export function toStockSummary({ symbol, bars, company }: SummaryInput): StockSummary | undefined {
  const q = quote(bars);
  if (!q) return undefined;
  return {
    symbol,
    name: company?.name ?? symbol,
    logoUrl: company?.logoUrl,
    close: q.close,
    change: q.change,
    changePct: q.changePct,
    marketCap: marketCap(q.close, company?.totalShares),
    asOf: q.asOf,
  };
}

export function toStockDetails(
  input: SummaryInput & { dividends?: Dividend[] },
): StockDetails | undefined {
  const summary = toStockSummary(input);
  if (!summary) return undefined;
  const { bars, company, dividends } = input;
  return {
    ...summary,
    ...sessionStats(bars),
    avgVolume: avgVolume(bars),
    ...range52w(bars),
    dividendYield: dividendYield(bars, dividends),
    sector: company?.sector,
    subsector: company?.subsector,
    segment: company?.segment,
    legalName: company?.legalName,
  };
}
