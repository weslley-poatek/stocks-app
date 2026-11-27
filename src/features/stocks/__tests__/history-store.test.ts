import * as fs from 'expo-file-system';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import price from '../api/__fixtures__/price.json';
import { BASE_URL } from '../api/client';
import { readHistory, writeHistory } from '../history-store';
import { loadHistory } from '../prices';

const HOUR = 3_600_000;
const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 26, 12);

const server = setupServer();
let requests = 0;
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  requests = 0;
  (fs as unknown as { __reset: () => void }).__reset();
  server.use(
    http.get(`${BASE_URL}/v1/tickers/:symbol/price`, () => {
      requests += 1;
      return HttpResponse.json(price);
    }),
  );
});

const seed = async (ageMs: number) => writeHistory('PETR4', [{ t: 1, close: 5 }], T0 - ageMs);

describe('history store', () => {
  it('round-trips a history with its fetch time, one file per symbol', async () => {
    await writeHistory('PETR4', [{ t: 1, close: 5 }], 123);
    await writeHistory('VALE3', [{ t: 2, close: 6 }], 456);
    expect(await readHistory('PETR4')).toEqual({ bars: [{ t: 1, close: 5 }], fetchedAt: 123 });
    expect((await readHistory('VALE3'))!.fetchedAt).toBe(456);
    expect(await readHistory('ITUB4')).toBeUndefined();
  });
  it('treats a corrupt file as missing', async () => {
    await writeHistory('PETR4', [], 1);
    const files = (fs as unknown as { __files: Map<string, string> }).__files;
    for (const k of files.keys()) files.set(k, '{not json');
    expect(await readHistory('PETR4')).toBeUndefined();
  });
});

describe('price freshness (market-data)', () => {
  it('Relaunch the same day: renders the stored history and makes no request', async () => {
    await seed(2 * HOUR);
    const bars = await loadHistory('idk_test1234', 'PETR4', { now: T0 });
    expect(bars).toEqual([{ t: 1, close: 5 }]);
    expect(requests).toBe(0);
  });
  it('refetches on launch once the file is older than 12 hours, and rewrites it', async () => {
    await seed(13 * HOUR);
    const bars = await loadHistory('idk_test1234', 'PETR4', { now: T0 });
    expect(requests).toBe(1);
    expect(bars.length).toBeGreaterThan(1);
    expect((await readHistory('PETR4'))!.fetchedAt).toBe(T0);
  });
  it('fetches when nothing is stored', async () => {
    await loadHistory('idk_test1234', 'PETR4', { now: T0 });
    expect(requests).toBe(1);
  });
  it('Pull to refresh too soon: no request 5 minutes after the last fetch', async () => {
    await seed(5 * MIN);
    await loadHistory('idk_test1234', 'PETR4', { refresh: true, now: T0 });
    expect(requests).toBe(0);
  });
  it('Pull to refresh later: refetches 20 minutes after the last fetch', async () => {
    await seed(20 * MIN);
    await loadHistory('idk_test1234', 'PETR4', { refresh: true, now: T0 });
    expect(requests).toBe(1);
  });
  it('refetches at exactly 15 minutes', async () => {
    await seed(15 * MIN);
    await loadHistory('idk_test1234', 'PETR4', { refresh: true, now: T0 });
    expect(requests).toBe(1);
  });
});
