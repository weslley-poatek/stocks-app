import companiesPage from '@/features/stocks/api/__fixtures__/companies-page.json';
import companyNulls from '@/features/stocks/api/__fixtures__/company-nulls.json';
import company from '@/features/stocks/api/__fixtures__/company.json';
import dividends from '@/features/stocks/api/__fixtures__/dividends.json';
import priceMs from '@/features/stocks/api/__fixtures__/price-ms.json';
import price from '@/features/stocks/api/__fixtures__/price.json';
import tickerNull from '@/features/stocks/api/__fixtures__/ticker-null-company.json';
import ticker from '@/features/stocks/api/__fixtures__/ticker.json';
import usageNull from '@/features/stocks/api/__fixtures__/usage-null-rate-limit.json';
import usage from '@/features/stocks/api/__fixtures__/usage.json';

const COMPANY_KEYS = [
  'id', 'legal_name', 'display_name', 'country_code', 'classification_system', 'sector',
  'subsector', 'segment', 'trading_segment', 'tickers', 'image_url', 'status', 'identifiers',
  'summary', 'created_at', 'updated_at',
];

describe('fixtures carry the OpenAPI required keys', () => {
  it.each([['usage', usage], ['usage-null-rate-limit', usageNull]])('%s', (_n, f) => {
    for (const k of ['key_prefix', 'role', 'tier', 'rate_limit', 'history']) expect(f).toHaveProperty(k);
    expect(['admin', 'free', 'pro', 'business']).toContain(f.role);
  });

  it('usage-null-rate-limit has nulls', () => {
    expect(usageNull.rate_limit).toBeNull();
    expect(usageNull.history.latency_ms).toBeNull();
    expect(usage.rate_limit?.minute).toEqual(
      expect.objectContaining({ limit: 25, used: 3, remaining: 22, resets_at: expect.any(String) }),
    );
  });

  it.each([['company', company], ['company-nulls', companyNulls]])('%s', (_n, f) => {
    for (const k of COMPANY_KEYS) expect(f).toHaveProperty(k);
  });

  it('company-nulls nulls every nullable field', () => {
    for (const k of ['country_code', 'classification_system', 'sector', 'subsector', 'segment', 'trading_segment', 'image_url', 'summary']) {
      expect((companyNulls as Record<string, unknown>)[k]).toBeNull();
    }
  });

  it('companies-page', () => {
    expect(companiesPage).toEqual(expect.objectContaining({ page: 1, limit: 100, total: 2 }));
    expect(companiesPage.data).toHaveLength(2);
    for (const c of companiesPage.data) for (const k of COMPANY_KEYS) expect(c).toHaveProperty(k);
  });

  it.each([['ticker', ticker], ['ticker-null-company', tickerNull]])('%s', (_n, f) => {
    for (const k of ['company_id', 'mic', 'symbol', 'asset_type', 'share_class']) expect(f).toHaveProperty(k);
  });

  it('ticker-null-company has a null company', () => {
    expect(tickerNull.company_id).toBeNull();
  });

  it('price is unsorted, in seconds, with one sparse bar', () => {
    expect(price.length).toBeGreaterThanOrEqual(10);
    const ts = price.map((b) => b.timestamp);
    expect(ts).not.toEqual([...ts].sort((a, b) => a - b));
    expect(Math.max(...ts)).toBeLessThan(1e12);
    expect(price.filter((b) => Object.keys(b).length === 2)).toHaveLength(1);
    for (const b of price) {
      expect(typeof b.timestamp).toBe('number');
      expect(typeof b.close).toBe('number');
    }
  });

  it('price-ms is price in milliseconds', () => {
    expect(priceMs).toEqual(price.map((b) => ({ ...b, timestamp: b.timestamp * 1000 })));
  });

  it('dividends', () => {
    for (const d of dividends) {
      expect(d.ex_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof d.amount).toBe('number');
      expect(d).toHaveProperty('date');
    }
    expect(dividends.some((d) => d.date === null)).toBe(true);
  });
});
