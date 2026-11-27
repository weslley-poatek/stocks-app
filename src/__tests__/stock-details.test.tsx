// Imported first: it registers the native-module mocks before the components load.
import { chartMock, resetChartMock, scrub } from '@/test-utils/chart-mocks';

import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { StyleSheet } from 'react-native';

import Details from '@/app/stock/[symbol]';
import companyFixture from '@/features/stocks/api/__fixtures__/company.json';
import dividendsFixture from '@/features/stocks/api/__fixtures__/dividends.json';
import tickerFixture from '@/features/stocks/api/__fixtures__/ticker.json';
import { mapCompany } from '@/features/stocks/api/mappers';
import { BASE_URL } from '@/features/stocks/api/client';
import { apiQueue } from '@/features/stocks/api/queue';
import { companyIndexKey } from '@/features/stocks/company-index';
import { dateOf } from '@/features/stocks/derive';
import { pricesKey } from '@/features/stocks/prices';
import { createQueryClient } from '@/features/stocks/query-client';
import { nearestBarIndex } from '@/features/stocks/scrub';
import type { Bar, Company } from '@/features/stocks/types';
import { formatCurrency, formatShortDate } from '@/shared/format';
import { lightPalette } from '@/shared/theme';

const PT = 'pt-BR';
let mockSymbol = 'PETR4';
const mockRouter = { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
const mockScreenOptions: Record<string, unknown>[] = [];

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pt-BR' }] }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/stocks/key-context', () => ({
  useKey: () => ({ ready: true, apiKey: 'idk_test1234' }),
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ symbol: mockSymbol }),
  useRouter: () => mockRouter,
  Stack: { Screen: ({ options }: { options: Record<string, unknown> }) => (mockScreenOptions.push(options), null) },
}));

const server = setupServer();
const requests: string[] = [];
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  apiQueue.configure({ limit: 1000 }); // the queue is a singleton; these tests send far more than 10 a minute
});
afterAll(() => server.close());

const DAY = 86_400_000;
const norm = (s: string) => s.replace(/[  ]/g, ' ');

/** One bar per calendar day ending on `end` (UTC midnight), closes from `close(i, n)`. */
function makeBars(end: string, n: number, close: (i: number, n: number) => number): Bar[] {
  const last = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const c = close(i, n);
    return { t: last - (n - 1 - i) * DAY, close: c, open: c - 1, high: c + 0.5, low: c - 0.5, volume: 1_000_000 };
  });
}

const flat = (v: number) => () => v;
const company = mapCompany(companyFixture as never);

let qc: QueryClient;
function seed(bars?: Bar[], companies: Company[] | null = [company], symbol = 'PETR4') {
  if (bars) qc.setQueryData(pricesKey(symbol), bars);
  if (companies) qc.setQueryData(companyIndexKey, companies);
}

function dividendsOk(body: unknown = dividendsFixture) {
  server.use(
    http.get(`${BASE_URL}/v1/tickers/:symbol/dividends`, ({ request }) => {
      requests.push(new URL(request.url).pathname);
      return HttpResponse.json(body as never);
    }),
  );
}

const renderDetails = () =>
  render(
    <QueryClientProvider client={qc}>
      <Details />
    </QueryClientProvider>,
  );

beforeEach(() => {
  qc = createQueryClient({ retryDelay: () => 1 });
  mockSymbol = 'PETR4';
  requests.length = 0;
  mockScreenOptions.length = 0;
  resetChartMock();
  jest.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-file-system').__reset();
  server.resetHandlers();
});

const lastLine = () => chartMock.lines[chartMock.lines.length - 1];
const lastData = () => chartMock.charts[chartMock.charts.length - 1].data;

// The logo is hidden from screen readers, so tests must look at hidden elements.
const HIDDEN = { includeHiddenElements: true };

describe('details header and price block (7.1)', () => {
  // 37.85 up 0.45 (1.19%...) is built from closes 37.40 -> 37.85 on 25 Nov.
  const priceBars = () => makeBars('2026-11-25', 30, (i, n) => (i === n - 1 ? 37.85 : 37.4));

  it('Price block: close, signed change in green, and the At close date', async () => {
    dividendsOk();
    seed(priceBars());
    await renderDetails();
    expect(screen.getByText(norm('R$ 37,85'), { exact: true, normalizer: norm })).toBeTruthy();
    const change = screen.getByText(/^\+R\$.0,45 \(\+1,20%\)$/);
    expect(StyleSheet.flatten(change.props.style).color).toBe(lightPalette.up);
    expect(screen.getByText(`At close, ${formatShortDate('2026-11-25', PT)}`)).toBeTruthy();
    expect(screen.getByText('PETR4')).toBeTruthy();
    expect(screen.getByText('Petrobras')).toBeTruthy();
  });

  it('No logo: ticker and name, with the ticker initials in a circle in place of the image', async () => {
    dividendsOk();
    seed(priceBars(), [{ ...company, logoUrl: undefined }]);
    await renderDetails();
    expect(screen.getByText('PETR4')).toBeTruthy();
    expect(screen.getByText('Petrobras')).toBeTruthy();
    expect(screen.queryAllByTestId('company-logo', HIDDEN)).toHaveLength(0);
    expect(screen.getByText('PE', HIDDEN)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('company-logo-box', HIDDEN).props.style)).toMatchObject({ width: 44, height: 44, borderRadius: 22 });
  });

  it('shows the logo when there is one', async () => {
    dividendsOk();
    seed(priceBars());
    await renderDetails();
    expect(screen.queryAllByTestId('company-logo', HIDDEN)).toHaveLength(1);
  });

  it('a logo that fails to load gives way to the initials, at the same size', async () => {
    dividendsOk();
    seed(priceBars());
    await renderDetails();
    await act(async () => {
      fireEvent(screen.getByTestId('company-logo', HIDDEN), 'error', { nativeEvent: {} });
    });
    expect(screen.queryAllByTestId('company-logo', HIDDEN)).toHaveLength(0);
    expect(screen.getByText('PE', HIDDEN)).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('company-logo-box', HIDDEN).props.style).width).toBe(44);
  });

  it('keeps the same space before, and after, the image loads', async () => {
    dividendsOk();
    seed(priceBars());
    await renderDetails();
    expect(StyleSheet.flatten(screen.getByTestId('company-logo-box', HIDDEN).props.style).width).toBe(44);
    await act(async () => {
      fireEvent(screen.getByTestId('company-logo', HIDDEN), 'load', { nativeEvent: {} });
    });
    expect(StyleSheet.flatten(screen.getByTestId('company-logo-box', HIDDEN).props.style).width).toBe(44);
    expect(screen.queryByText('PE', HIDDEN)).toBeNull();
  });

  it('a ticker with no company shows no name, logo or About', async () => {
    dividendsOk();
    server.use(
      http.get(`${BASE_URL}/v1/tickers/:symbol`, () => HttpResponse.json({ ...tickerFixture, company_id: null })),
    );
    seed(priceBars(), []);
    await renderDetails();
    await waitFor(() => expect(screen.queryByText('Petrobras')).toBeNull());
    expect(screen.queryByText('About')).toBeNull();
    expect(screen.queryAllByTestId('company-logo', HIDDEN)).toHaveLength(0);
  });

  it('From the list: renders on the first frame, and makes only a dividends request', async () => {
    server.use(
      http.all('*', ({ request }) => {
        requests.push(new URL(request.url).pathname);
        return HttpResponse.json(dividendsFixture);
      }),
    );
    seed(priceBars());
    await renderDetails();
    // No waiting: close, change and the 1W chart are there on the first render.
    expect(screen.getByText(/^R\$.37,85$/)).toBeTruthy();
    expect(screen.getByText(/^\+R\$.0,45/)).toBeTruthy();
    expect(lastData().length).toBeGreaterThan(1);
    await waitFor(() => expect(requests).toEqual(['/v1/tickers/PETR4/dividends']));
  });

  it('Back to list: a pushed screen on the native header, titled with the ticker', async () => {
    dividendsOk();
    seed(priceBars());
    await renderDetails();
    expect(mockScreenOptions.every((o) => o.headerShown !== false)).toBe(true);
    expect(mockScreenOptions.some((o) => o.title === 'PETR4')).toBe(true);
  });
});

describe('range selector and chart (7.2)', () => {
  const yearBars = (close: (i: number, n: number) => number) => makeBars('2026-11-25', 400, close);

  it('exposes the ranges as a tab list, 1W selected', async () => {
    dividendsOk();
    seed(yearBars(flat(10)));
    await renderDetails();
    expect(screen.getByTestId('range-selector').props.accessibilityRole).toBe('tablist');
    expect(screen.getAllByRole('tab')).toHaveLength(8);
    expect(screen.getByRole('tab', { name: '1 week', selected: true })).toBeTruthy();
    for (const name of ['1 month', '3 months', '6 months', 'year to date', '1 year', '5 years', 'all time']) {
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    }
  });

  it('Switching range: redraws from the cache, with no request beyond dividends', async () => {
    dividendsOk();
    seed(yearBars((i) => 10 + i * 0.01));
    await renderDetails();
    await waitFor(() => expect(requests).toHaveLength(1));
    const week = lastData().length;
    await fireEvent.press(screen.getByRole('tab', { name: '1 year' }));
    expect(lastData().length).toBeGreaterThan(300);
    expect(lastData().length).toBeGreaterThan(week);
    expect(screen.getByRole('tab', { name: '1 year', selected: true })).toBeTruthy();
    expect(requests).toEqual(['/v1/tickers/PETR4/dividends']);
  });

  it('Down range: a 3M range ending below its start draws red', async () => {
    dividendsOk();
    seed(yearBars((i, n) => 50 - (i / n) * 10));
    await renderDetails();
    await fireEvent.press(screen.getByRole('tab', { name: '3 months' }));
    expect(lastLine().color).toBe(lightPalette.down);
  });

  it('draws the grid in the palette separator colour', async () => {
    dividendsOk();
    seed(yearBars((i) => 10 + i * 0.01));
    await renderDetails();
    expect(chartMock.charts[chartMock.charts.length - 1].gridColor).toBe(lightPalette.separator);
  });

  it('draws green when the range ends at or above its start', async () => {
    dividendsOk();
    seed(yearBars((i) => 10 + i * 0.01));
    await renderDetails();
    expect(lastLine().color).toBe(lightPalette.up);
  });

  it('Chart label: range, direction, percent and start and end prices', async () => {
    dividendsOk();
    const bars = makeBars('2026-11-25', 120, flat(36));
    bars[bars.findIndex((b) => dateOf(b.t) === '2026-10-25')].close = 35.1;
    bars[bars.length - 1].close = 36.61;
    seed(bars);
    await renderDetails();
    await fireEvent.press(screen.getByRole('tab', { name: '1 month' }));
    expect(screen.getByLabelText(/^1 month, up 4,3 percent, from R\$.35,10 to R\$.36,61$/)).toBeTruthy();
  });
});

describe('scrubbing (7.3)', () => {
  it('nearestBarIndex maps a touched time to the nearest bar', () => {
    const times = [0, 10, 20, 100];
    expect(nearestBarIndex(times, -5)).toBe(0);
    expect(nearestBarIndex(times, 4)).toBe(0);
    expect(nearestBarIndex(times, 6)).toBe(1);
    expect(nearestBarIndex(times, 15)).toBe(1); // a tie goes to the earlier bar
    expect(nearestBarIndex(times, 61)).toBe(3);
    expect(nearestBarIndex(times, 60)).toBe(2);
    expect(nearestBarIndex(times, 500)).toBe(3);
    expect(nearestBarIndex([], 3)).toBe(-1);
    expect(nearestBarIndex([7], 3)).toBe(0);
  });

  const scrubBars = () => makeBars('2026-11-25', 60, (i) => 30 + i);

  it('Scrubbing: each day shows its close and date, with one haptic tick per change', async () => {
    dividendsOk();
    seed(scrubBars());
    await renderDetails();
    await fireEvent.press(screen.getByRole('tab', { name: '1 month' }));
    const data = lastData();
    const at = (k: number) => data[k].x;
    const closeOf = (k: number) => formatCurrency(data[k].y, PT);

    for (const k of [3, 4, 5]) {
      await act(async () => scrub(at(k) + 1000)); // a little off the bar, still nearest to it
      expect(screen.getByText(closeOf(k), { normalizer: norm, exact: false })).toBeTruthy();
      expect(screen.getByText(formatShortDate(dateOf(at(k)), PT))).toBeTruthy();
      expect(screen.queryByText(/At close/)).toBeNull();
    }
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);

    await act(async () => scrub(at(5) + 2000)); // same bar: no new tick, no new update
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
  });

  it('Release: the latest close and the At close date come back', async () => {
    dividendsOk();
    const bars = scrubBars();
    seed(bars);
    await renderDetails();
    await fireEvent.press(screen.getByRole('tab', { name: '1 month' }));
    await act(async () => scrub(lastData()[2].x));
    expect(screen.queryByText(/At close/)).toBeNull();
    await act(async () => scrub(null));
    expect(screen.getByText(/^R\$.89,00$/)).toBeTruthy();
    expect(screen.getByText(`At close, ${formatShortDate('2026-11-25', PT)}`)).toBeTruthy();
  });
});

describe('stats and About (7.4)', () => {
  const bars = () => makeBars('2026-11-25', 60, flat(40));

  it('No share count: the grid has no Market cap cell and no placeholder', async () => {
    dividendsOk();
    seed(bars(), [{ ...company, totalShares: undefined }]);
    await renderDetails();
    expect(screen.queryByText(/Market cap/)).toBeNull();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.getByText('Open')).toBeTruthy();
    // And with one, the cell is there.
  });

  it('shows Market cap when the company has a share count', async () => {
    dividendsOk();
    seed(bars());
    await renderDetails();
    expect(screen.getByText('Market cap (approx.)')).toBeTruthy();
  });

  it('Dividends loading: a skeleton until they arrive, then the yield', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    server.use(
      http.get(`${BASE_URL}/v1/tickers/:symbol/dividends`, async () => {
        await gate;
        return HttpResponse.json(dividendsFixture);
      }),
    );
    seed(bars());
    await renderDetails();
    expect(screen.getByText('Dividend yield (TTM)')).toBeTruthy();
    expect(screen.getByTestId('dividend-skeleton')).toBeTruthy();
    release();
    await waitFor(() => expect(screen.queryByTestId('dividend-skeleton')).toBeNull());
    // 0,4812 + 0,2214 + 0,3159 over a close of 40: 2,55%
    expect(screen.getByText(/^2,55%$/)).toBeTruthy();
  });

  it('Plan excludes dividends: a 403 shows Not included in your plan', async () => {
    server.use(http.get(`${BASE_URL}/v1/tickers/:symbol/dividends`, () => new HttpResponse(null, { status: 403 })));
    seed(bars());
    await renderDetails();
    expect(await screen.findByText('Not included in your plan')).toBeTruthy();
    expect(screen.queryByTestId('dividend-skeleton')).toBeNull();
  });

  it('Full classification: sector › subsector › segment, then the legal name', async () => {
    dividendsOk();
    seed(bars());
    await renderDetails();
    expect(
      screen.getByText(
        'Petróleo, Gás e Biocombustíveis › Petróleo, Gás e Biocombustíveis › Exploração, Refino e Distribuição',
      ),
    ).toBeTruthy();
    expect(screen.getByText('PETROLEO BRASILEIRO S.A. PETROBRAS')).toBeTruthy();
  });

  it('leaves out a missing classification part', async () => {
    dividendsOk();
    seed(bars(), [{ ...company, subsector: undefined, segment: undefined }]);
    await renderDetails();
    expect(screen.getByText('Petróleo, Gás e Biocombustíveis')).toBeTruthy();
  });
});

describe('states (7.5)', () => {
  it('Unknown symbol: says the ticker was not found, with a way back', async () => {
    mockSymbol = 'ZZZZ9';
    server.use(
      http.get(`${BASE_URL}/v1/tickers/:symbol/price`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${BASE_URL}/v1/tickers/:symbol/dividends`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${BASE_URL}/v1/tickers/:symbol`, () => new HttpResponse(null, { status: 404 })),
    );
    seed(undefined, []);
    await renderDetails();
    expect(await screen.findByText("ZZZZ9 wasn't found")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to list' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('Back to list goes home when there is nothing to go back to', async () => {
    mockSymbol = 'ZZZZ9';
    mockRouter.canGoBack.mockReturnValueOnce(false);
    server.use(
      http.get(`${BASE_URL}/v1/tickers/:symbol/price`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${BASE_URL}/v1/tickers/:symbol/dividends`, () => new HttpResponse(null, { status: 404 })),
      http.get(`${BASE_URL}/v1/tickers/:symbol`, () => new HttpResponse(null, { status: 404 })),
    );
    seed(undefined, []);
    await renderDetails();
    await fireEvent.press(await screen.findByRole('button', { name: 'Back to list' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('Chart load failure: Retry in the chart area, and the header and About still show', async () => {
    let fail = true;
    const good = makeBars('2026-11-25', 30, flat(37.85));
    server.use(
      http.get(`${BASE_URL}/v1/tickers/:symbol/price`, () =>
        fail
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json(
              good.map((b) => ({ timestamp: b.t / 1000, close: b.close, open: b.open, high: b.high, low: b.low, volume: b.volume })),
            ),
      ),
    );
    dividendsOk();
    seed(undefined);
    await renderDetails();
    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByText('PETR4')).toBeTruthy();
    expect(screen.getByText('Petrobras')).toBeTruthy();
    expect(screen.getByText('About')).toBeTruthy();
    expect(chartMock.charts).toHaveLength(0);

    fail = false;
    await fireEvent.press(retry);
    await waitFor(() => expect(chartMock.charts.length).toBeGreaterThan(0));
    expect(lastData().length).toBeGreaterThan(1);
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
