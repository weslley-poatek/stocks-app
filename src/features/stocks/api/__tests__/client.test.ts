import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import price from '../__fixtures__/price.json';
import usage from '../__fixtures__/usage.json';
import { ApiError, BASE_URL, createClient } from '../client';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const api = createClient('idk_test1234');
const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ApiError ? e.kind : 'other';
  }
  return 'resolved';
};

describe('client', () => {
  it('sends the x-api-key header and maps the body', async () => {
    let sent: string | null = null;
    server.use(
      http.get(`${BASE_URL}/v1/usage`, ({ request }) => {
        sent = request.headers.get('x-api-key');
        return HttpResponse.json(usage);
      }),
    );
    const status = await api.usage();
    expect(sent).toBe('idk_test1234');
    expect(status.plan).toBe('free');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [429, 'rateLimited'],
    [500, 'unknown'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    server.use(http.get(`${BASE_URL}/v1/tickers/:s/price`, () => new HttpResponse(null, { status })));
    expect(await kindOf(api.price('PETR4'))).toBe(kind);
  });

  it('maps a network failure to network', async () => {
    server.use(http.get(`${BASE_URL}/v1/tickers/:s/price`, () => HttpResponse.error()));
    expect(await kindOf(api.price('PETR4'))).toBe('network');
  });

  it('maps an invalid body and a non-JSON body to invalidResponse', async () => {
    server.use(http.get(`${BASE_URL}/v1/tickers/:s/price`, () => HttpResponse.json([{ timestamp: 1, close: 'x' }])));
    expect(await kindOf(api.price('PETR4'))).toBe('invalidResponse');
    server.use(http.get(`${BASE_URL}/v1/tickers/:s/price`, () => new HttpResponse('<html>', { status: 200 })));
    expect(await kindOf(api.price('PETR4'))).toBe('invalidResponse');
  });

  it('reads Retry-After and a body resets_at on a 429', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/tickers/:s/price`, () => new HttpResponse(null, { status: 429, headers: { 'Retry-After': '7' } })),
    );
    await expect(api.price('X')).rejects.toMatchObject({ kind: 'rateLimited', retryAfterMs: 7000 });
    server.use(
      http.get(`${BASE_URL}/v1/tickers/:s/price`, () =>
        HttpResponse.json({ resets_at: new Date(Date.now() + 20_000).toISOString() }, { status: 429 }),
      ),
    );
    const err = await api.price('X').catch((e: ApiError) => e);
    expect((err as ApiError).retryAfterMs).toBeGreaterThan(15_000);
  });

  it('maps prices end to end', async () => {
    server.use(http.get(`${BASE_URL}/v1/tickers/:s/price`, () => HttpResponse.json(price)));
    const bars = await api.price('PETR4');
    expect(bars.length).toBe(price.length);
    expect(bars[0].t).toBeLessThan(bars[bars.length - 1].t);
  });

  it('logs one [req] line per request: path only, never the key or the query', async () => {
    server.use(http.get(`${BASE_URL}/v1/companies`, () => HttpResponse.json({ data: [] })));
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    process.env.STOCKS_DEV_LOG = '1';
    try {
      await api.companies(1).catch(() => undefined);
      const lines = spy.mock.calls.map((c) => c.join(' '));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(/^\[req\] \d+ \/v1\/companies$/);
      expect(lines.join('\n')).not.toContain('idk_test1234');
    } finally {
      delete process.env.STOCKS_DEV_LOG;
      spy.mockRestore();
    }
  });
});
