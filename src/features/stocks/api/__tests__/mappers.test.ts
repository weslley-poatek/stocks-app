import dividends from '../__fixtures__/dividends.json';
import companiesPage from '../__fixtures__/companies-page.json';
import companyNulls from '../__fixtures__/company-nulls.json';
import company from '../__fixtures__/company.json';
import priceMs from '../__fixtures__/price-ms.json';
import price from '../__fixtures__/price.json';
import tickerNull from '../__fixtures__/ticker-null-company.json';
import ticker from '../__fixtures__/ticker.json';
import usageNull from '../__fixtures__/usage-null-rate-limit.json';
import usage from '../__fixtures__/usage.json';
import {
  mapBars,
  mapCompaniesPage,
  mapCompany,
  mapDividends,
  mapTicker,
  mapUsage,
  parseExDate,
  toStockDetails,
  toStockSummary,
} from '../mappers';
import {
  companiesPageSchema,
  companySchema,
  dividendsSchema,
  parsePrice,
  tickerSchema,
  usageSchema,
} from '../schemas';

describe('usage', () => {
  it('maps role to plan and the limits', () => {
    expect(mapUsage(usageSchema.parse(usage))).toEqual({
      keyPrefix: 'idk_a1b2',
      plan: 'free',
      perMinute: 25,
      perDay: 500,
      remainingToday: 380,
      minuteResetsAt: '2026-11-26T14:31:00.000Z',
    });
  });
  it('cuts a long key_prefix to 8 characters', () => {
    const long = 'idk_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7';
    const s = mapUsage(usageSchema.parse({ ...usage, key_prefix: long }));
    expect(s.keyPrefix).toBe('idk_a1b2');
    expect(JSON.stringify(s)).not.toContain('c3d4');
  });
  it('leaves limits absent when rate_limit is null', () => {
    const s = mapUsage(usageSchema.parse(usageNull));
    expect(s.perMinute).toBeUndefined();
    expect(s.perDay).toBeUndefined();
    expect(s.plan).toBe('free');
  });
  it('rejects an unknown role', () => {
    expect(() => usageSchema.parse({ ...usage, role: 'root' })).toThrow();
  });
});

describe('companies', () => {
  it('maps a company', () => {
    const c = mapCompany(companySchema.parse(company));
    expect(c).toMatchObject({
      id: company.id,
      name: 'Petrobras',
      legalName: company.legal_name,
      tickers: ['PETR3', 'PETR4'],
      totalShares: 13043907395,
    });
  });
  it('turns nulls into absent fields', () => {
    const c = mapCompany(companySchema.parse(companyNulls));
    expect(c.logoUrl).toBeUndefined();
    expect(c.totalShares).toBeUndefined();
    expect(c.sector).toBeUndefined();
    expect(c.segment).toBeUndefined();
  });
  it('computes the page count from total and limit', () => {
    const p = mapCompaniesPage(companiesPageSchema.parse(companiesPage));
    expect(p.pageCount).toBe(Math.ceil(companiesPage.total / companiesPage.limit));
    expect(p.companies.length).toBe(companiesPage.data.length);
  });
});

describe('ticker', () => {
  it('maps company_id', () => {
    expect(mapTicker(tickerSchema.parse(ticker))).toEqual({ symbol: 'PETR4', companyId: ticker.company_id });
  });
  it('maps a null company_id to absent', () => {
    expect(mapTicker(tickerSchema.parse(tickerNull)).companyId).toBeUndefined();
  });
});

describe('price bars', () => {
  it('maps both timestamp units to the same dates, sorted ascending', () => {
    const a = mapBars(parsePrice(price));
    const b = mapBars(parsePrice(priceMs));
    expect(a.map((x) => x.t)).toEqual(b.map((x) => x.t));
    expect(a.map((x) => x.t)).toEqual([...a.map((x) => x.t)].sort((x, y) => x - y));
    expect(a[0].t).toBeGreaterThan(1e12);
  });
  it('drops duplicate timestamps', () => {
    const bars = mapBars([
      { timestamp: 1, close: 1 },
      { timestamp: 1, close: 2 },
    ]);
    expect(bars).toEqual([{ t: 1000, close: 2 }].map((x) => expect.objectContaining(x)));
  });
  it('fails a malformed bar', () => {
    expect(() => parsePrice([{ timestamp: 1, close: 'x' }])).toThrow();
    expect(() => parsePrice([{ close: 1 }])).toThrow();
    expect(() => parsePrice({})).toThrow();
  });
});

describe('release sampling (D7)', () => {
  const bars = (n: number) => Array.from({ length: n }, (_, i) => ({ timestamp: 1_000_000 + i * 86400, close: 10 }));
  it('accepts a valid 5,000-bar history', () => {
    expect(parsePrice(bars(5000), false)).toHaveLength(5000);
    expect(parsePrice(bars(5000), true)).toHaveLength(5000);
  });
  it('checks the first and last 50 bars only', () => {
    const b = bars(5000) as Record<string, unknown>[];
    b[2500] = { timestamp: 'bad' };
    expect(() => parsePrice(b, false)).not.toThrow();
    expect(() => parsePrice(b, true)).toThrow();
    b[49] = { timestamp: 'bad' };
    expect(() => parsePrice(b, false)).toThrow();
    b[49] = b[0];
    b[4950] = { timestamp: 'bad' };
    expect(() => parsePrice(b, false)).toThrow();
  });
});

describe('dividends', () => {
  it('maps and sorts newest first', () => {
    expect(mapDividends(dividendsSchema.parse(dividends)).map((d) => d.exDate)).toEqual([
      '2026-08-21',
      '2026-05-20',
      '2026-03-18',
    ]);
  });
  it('parses dates and date-times, and drops unparseable ones', () => {
    expect(parseExDate('2026-08-21T00:00:00.000Z')).toBe('2026-08-21');
    expect(parseExDate('1525143600')).toBe('2018-05-01'); // epoch seconds, as the real API sends
    expect(parseExDate('1525143600000')).toBe('2018-05-01');
    expect(mapDividends([{ ex_date: '1525143600', amount: 0.5 }])).toEqual([{ exDate: '2018-05-01', amount: 0.5 }]);
    expect(parseExDate('21/08/2026')).toBeUndefined();
    expect(parseExDate('2026-02-31')).toBeUndefined();
    expect(mapDividends([{ ex_date: 'soon', amount: 1 }])).toEqual([]);
  });
});

describe('stock summary and details', () => {
  const bars = mapBars(parsePrice(price));
  const co = mapCompany(companySchema.parse(company));
  it('builds a summary from the last two bars', () => {
    const s = toStockSummary({ symbol: 'PETR4', bars, company: co })!;
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2];
    expect(s.close).toBe(last.close);
    expect(s.change).toBeCloseTo(last.close - prev.close);
    expect(s.marketCap).toBeCloseTo(last.close * 13043907395);
    expect(s.changePct).toBeCloseTo((last.close - prev.close) / prev.close, 10); // a fraction
    expect(Math.abs(s.changePct!)).toBeLessThan(1);
    expect(s.name).toBe('Petrobras');
    expect(s.asOf).toBe(new Date(last.t).toISOString().slice(0, 10));
  });
  it('falls back to the symbol with no company, and has no market cap', () => {
    const s = toStockSummary({ symbol: 'XXXX3', bars })!;
    expect(s.name).toBe('XXXX3');
    expect(s.marketCap).toBeUndefined();
  });
  it('returns undefined without bars', () => {
    expect(toStockSummary({ symbol: 'X', bars: [] })).toBeUndefined();
  });
  it('builds details with 52-week range and trailing yield', () => {
    const d = toStockDetails({ symbol: 'PETR4', bars, company: co, dividends: [{ exDate: '2000-01-01', amount: 1 }] })!;
    expect(d.high52w).toBe(Math.max(...bars.flatMap((b) => (b.high === undefined ? [] : [b.high]))));
    expect(d.low52w).toBe(Math.min(...bars.flatMap((b) => (b.low === undefined ? [] : [b.low]))));
    expect(d.dividendYield).toBe(0);
    expect(d.legalName).toBe(co.legalName);
  });
  it('gives the yield as a fraction', () => {
    const lastBar = bars[bars.length - 1];
    const exDate = new Date(lastBar.t).toISOString().slice(0, 10);
    const d = toStockDetails({ symbol: 'PETR4', bars, dividends: [{ exDate, amount: lastBar.close / 10 }] })!;
    expect(d.dividendYield).toBeCloseTo(0.1, 10);
  });
  it('has no yield while dividends are unknown', () => {
    expect(toStockDetails({ symbol: 'PETR4', bars })!.dividendYield).toBeUndefined();
  });
});
