import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Platform, StyleSheet } from 'react-native';

import Index from '@/app/index';
import companiesPage from '@/features/stocks/api/__fixtures__/companies-page.json';
import { BASE_URL } from '@/features/stocks/api/client';
import { apiQueue } from '@/features/stocks/api/queue';
import { companyIndexKey } from '@/features/stocks/company-index';
import { writeHistory } from '@/features/stocks/history-store';
import { appCacheStore } from '@/features/stocks/persister';
import { createQueryClient } from '@/features/stocks/query-client';
import { STARTERS } from '@/features/stocks/starter';
import { formatCompactCurrency, formatCurrency, formatPercent, formatShortDate, formatSignedCurrency } from '@/shared/format';
import { lightPalette } from '@/shared/theme';

let mockLocale = 'en-GB';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: mockLocale }] }));
const mockPush = jest.fn();
let mockScreenOptions: Record<string, unknown> = {};
jest.mock('expo-router', () => ({
  Stack: { Screen: ({ options }: { options: Record<string, unknown> }) => ((mockScreenOptions = options), null) },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('@/features/stocks/key-context', () => ({
  useKey: () => ({ ready: true, apiKey: 'idk_test1234', save: jest.fn() }),
}));

// --- Fixtures -------------------------------------------------------------------------------
const SESSION = Date.UTC(2025, 10, 25) / 1000;
const DAY = 86_400;
type Spec = { closes: number[]; volume: number };
const defaultSpec = (i: number): Spec => ({ closes: [10, 10.1, 10.2, 10.3, 10.4, 10.5 + i / 100], volume: 1_000_000 + i * 1000 });
const specs: Record<string, Spec> = {};
const barsFor = (symbol: string) => {
  const spec = specs[symbol] ?? defaultSpec(STARTERS.indexOf(symbol as (typeof STARTERS)[number]));
  return spec.closes.map((close, i) => ({
    timestamp: SESSION - (spec.closes.length - 1 - i) * DAY,
    close,
    volume: spec.volume,
  }));
};

type Template = (typeof companiesPage.data)[number];
const template = companiesPage.data[0] as Template;
const NAMES: Record<string, string> = { PETR4: 'Petrobras', VALE3: 'Vale' };
const company = (tickers: string[], name: string, shares: number | null = 1e9): unknown => ({
  ...template,
  id: tickers.join('-'),
  display_name: name,
  legal_name: `${name.toUpperCase()} S.A.`,
  tickers,
  summary: shares === null ? null : { ...template.summary, total_shares: shares },
});
const fullIndex = (without: string[] = [], extra: unknown[] = []) => [
  ...STARTERS.filter((s) => !without.includes(s)).map((s) => company([s], NAMES[s] ?? `Company ${s}`)),
  company(['PETR3'], 'Petrobras ON'),
  ...extra,
];

const HIDDEN = { includeHiddenElements: true };

// --- Server ---------------------------------------------------------------------------------
const server = setupServer();
let requests: string[] = [];
let priceGate: Promise<void> | undefined;
let gated: (symbol: string) => boolean = () => false;
let indexGate: Promise<void> | undefined;
let indexData: unknown[] = fullIndex();
let indexFails = false;
let indexTotal = 0;
let searchData: unknown[] = [];
let priceFails: Record<string, number | 'network'> = {};
let allPricesFail = false;

function useHandlers() {
  server.use(
    http.get(`${BASE_URL}/v1/companies`, async ({ request }) => {
      const url = new URL(request.url);
      requests.push(`companies?${url.searchParams.has('search') ? 'search' : `page=${url.searchParams.get('page')}`}`);
      if (url.searchParams.has('search')) {
        return HttpResponse.json({ data: searchData, page: 1, limit: 100, total: searchData.length });
      }
      await indexGate;
      if (indexFails) return HttpResponse.error();
      return HttpResponse.json({
        data: indexData,
        page: Number(url.searchParams.get('page')),
        limit: 100,
        total: indexTotal || indexData.length,
      });
    }),
    http.get(`${BASE_URL}/v1/tickers/:symbol/price`, async ({ params }) => {
      const symbol = String(params.symbol);
      requests.push(`price:${symbol}`);
      if (gated(symbol)) await priceGate;
      if (allPricesFail) return HttpResponse.error();
      const fail = priceFails[symbol];
      if (fail === 'network') return HttpResponse.error();
      if (fail) return new HttpResponse(null, { status: fail });
      return HttpResponse.json(barsFor(symbol));
    }),
    http.get(`${BASE_URL}/v1/tickers/:symbol`, ({ params }) => {
      requests.push(`ticker:${String(params.symbol)}`);
      return priceFails[`lookup:${String(params.symbol)}`]
        ? new HttpResponse(null, { status: 404 })
        : HttpResponse.json({ symbol: params.symbol, company_id: null });
    }),
  );
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  apiQueue.configure({ limit: 1000 });
});
afterAll(() => server.close());
beforeEach(() => {
  server.resetHandlers();
  useHandlers();
  requests = [];
  priceGate = indexGate = undefined;
  gated = () => false;
  indexData = fullIndex();
  indexTotal = 0;
  indexFails = false;
  searchData = [];
  priceFails = {};
  allPricesFail = false;
  Object.keys(specs).forEach((k) => delete specs[k]);
  mockLocale = 'en-GB';
  mockScreenOptions = {};
  mockPush.mockClear();
  appCacheStore().clearAll();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-file-system').__reset();
});
afterEach(() => {
  Platform.OS = 'ios';
});

async function renderList(qc: QueryClient = createQueryClient({ retryDelay: () => 0 })) {
  const utils = await render(
    <QueryClientProvider client={qc}>
      <Index />
    </QueryClientProvider>,
  );
  return { qc, ...utils };
}
// FlashList recycles cells, so the rendered order isn't the list order; each cell carries its index.
const rowIds = () =>
  screen
    .queryAllByTestId(/^row-[A-Z0-9]+$/)
    .sort((a, b) => (a.parent?.props.index ?? 0) - (b.parent?.props.index ?? 0))
    .map((n) => String(n.props.testID).slice(4));
const pillText = (symbol: string) => {
  const t = within(screen.getByTestId(`row-${symbol}`)).getByTestId('change-pill');
  return { text: within(t).queryByText(/.+/)?.props.children ?? '', pill: t };
};
const lastClose = (symbol: string) => barsFor(symbol).at(-1)!.close;
const typeInSearch = (text: string) =>
  act(async () => {
    (mockScreenOptions.headerSearchBarOptions as { onChangeText: (e: unknown) => void }).onChangeText({ nativeEvent: { text } });
  });

async function seedFiles(ageMs: number) {
  const fetchedAt = Date.now() - ageMs;
  for (const s of STARTERS) await writeHistory(s, barsFor(s).map((b) => ({ t: b.timestamp * 1000, close: b.close, volume: b.volume })), fetchedAt);
}

// --- Starter list (6.1) -----------------------------------------------------------------------
describe('starter list', () => {
  it('Sorted by volume: rows are ordered by the last bar volume, highest first', async () => {
    const volumes: Record<string, number> = { PETR4: 5, VALE3: 9, ITUB4: 1, BBDC4: 7 };
    STARTERS.forEach((s, i) => (specs[s] = { ...defaultSpec(i), volume: volumes[s] ?? 100 + i }));
    await renderList();
    await waitFor(() => expect(rowIds().length).toBe(15));
    await waitFor(() => expect(screen.queryAllByTestId('price-skeleton').length).toBe(0));
    const expected = [...STARTERS].sort((a, b) => specs[b].volume - specs[a].volume);
    expect(rowIds()).toEqual(expected);
    // the order is kept for the next launch (D9)
    expect(JSON.parse(appCacheStore().getString('starter-order')!)).toEqual(expected);
  });

  it('shows the last session volume order, then starter order on a first run, until every history arrives', async () => {
    appCacheStore().set('starter-order', JSON.stringify(['SBSP3', 'EQTL3']));
    priceGate = new Promise(() => {});
    gated = () => true;
    await renderList();
    await waitFor(() => expect(rowIds().length).toBe(15));
    expect(rowIds().slice(0, 3)).toEqual(['SBSP3', 'EQTL3', 'PETR4']);
  });

  it('Delisted starter: a 404 on the lookup (not in the index) drops it and keeps the others', async () => {
    indexData = fullIndex(['RENT3']);
    priceFails['lookup:RENT3'] = 404;
    await renderList();
    await waitFor(() => expect(rowIds().length).toBe(14));
    await waitFor(() => expect(screen.queryAllByTestId('price-skeleton').length).toBe(0));
    expect(rowIds()).not.toContain('RENT3');
    expect(rowIds()).toContain('PETR4');
    expect(requests).toContain('ticker:RENT3');
    expect(requests).not.toContain('price:RENT3');
  });

  it('drops a starter whose price history is 404 (B3SA3 today), with no "n/a" row', async () => {
    priceFails.B3SA3 = 404;
    await renderList();
    await waitFor(() => expect(rowIds().length).toBe(14));
    await waitFor(() => expect(screen.queryAllByTestId('price-skeleton').length).toBe(0));
    expect(rowIds()).not.toContain('B3SA3');
    expect(screen.queryByText('n/a')).toBeNull();
  });

  it('keeps a starter the index lacks when its lookup succeeds', async () => {
    indexData = fullIndex(['RENT3']);
    await renderList();
    await waitFor(() => expect(rowIds()).toContain('RENT3'));
    expect(requests.filter((r) => r.startsWith('ticker:'))).toEqual(['ticker:RENT3']);
  });

  it('First rows appear early: 5 of 15 histories show prices, the rest show skeletons', async () => {
    let release: () => void = () => {};
    priceGate = new Promise<void>((r) => (release = r));
    const early = new Set(STARTERS.slice(0, 5));
    gated = (s) => !early.has(s as never);
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(5));
    expect(screen.getAllByTestId('price-skeleton').length).toBe(10);
    expect(rowIds().length).toBe(15);
    release();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
  });

  it('cold start: 5 index requests, 15 price requests and no starter lookups when the index has every starter', async () => {
    indexTotal = 500;
    await renderList();
    await waitFor(() => expect(rowIds().length).toBe(15));
    await waitFor(() => expect(screen.queryAllByTestId('price-skeleton').length).toBe(0));
    expect(requests.filter((r) => r.startsWith('companies?page=')).sort()).toEqual(
      [1, 2, 3, 4, 5].map((p) => `companies?page=${p}`),
    );
    expect(requests.filter((r) => r.startsWith('price:')).length).toBe(15);
    expect(requests.filter((r) => r.startsWith('ticker:')).length).toBe(0);
  });
});

// --- Row (6.2) ----------------------------------------------------------------------------------
describe('row', () => {
  it('shows the ticker over the company name, and the ticker alone with no company', async () => {
    indexData = fullIndex(['SBSP3']);
    await renderList();
    await waitFor(() => expect(screen.getByTestId('row-SBSP3')).toBeTruthy());
    await waitFor(() => expect(within(screen.getByTestId('row-SBSP3')).queryByTestId('change-pill')).toBeTruthy());
    const row = within(screen.getByTestId('row-PETR4'));
    expect(row.getByText('PETR4')).toBeTruthy();
    expect(row.getByText('Petrobras').props.numberOfLines).toBe(1);
    expect(within(screen.getByTestId('row-SBSP3')).queryByText(/Company/)).toBeNull();
    expect(screen.getByTestId('row-SBSP3').props.accessibilityLabel).toMatch(/^SBSP3, R\$/);
  });

  it('Falling stock: VALE3 down 0.8% has a red pill reading "−0,80%" in pt-BR, with a red sparkline', async () => {
    mockLocale = 'pt-BR';
    specs.VALE3 = { closes: [101, 100.5, 100.2, 100, 99.2], volume: 10 }; // previous close 100, last 99.2: -0.8%
    await renderList();
    await waitFor(() => expect(within(screen.getByTestId('row-VALE3')).queryByTestId('change-pill')).toBeTruthy());
    const { text, pill } = pillText('VALE3');
    expect(text).toBe(formatPercent(-0.008, { locale: 'pt-BR' }));
    expect(text).toMatch(/^[-−−]0,80%$/);
    expect(JSON.stringify(pill.props.style)).toContain(lightPalette.pill.down.bg);
    const seg = within(screen.getByTestId('row-VALE3')).getAllByTestId('sparkline-segment')[0];
    expect(JSON.stringify(seg.props.style)).toContain(lightPalette.down);
  });

  it('draws a green sparkline and pill for a rising stock, from the last 5 closes', async () => {
    await renderList();
    await waitFor(() => expect(within(screen.getByTestId('row-PETR4')).queryByTestId('change-pill')).toBeTruthy());
    const row = within(screen.getByTestId('row-PETR4'));
    expect(row.getAllByTestId('sparkline-segment').length).toBe(4);
    expect(JSON.stringify(row.getAllByTestId('sparkline-segment')[0].props.style)).toContain(lightPalette.up);
    expect(JSON.stringify(pillText('PETR4').pill.props.style)).toContain(lightPalette.pill.up.bg);
  });

  it('Cycling: two taps from the default show market cap on every row, a third returns to %', async () => {
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    const pcts = STARTERS.map((s) => pillText(s).text);
    expect(pcts[0]).toMatch(/%$/);
    await fireEvent.press(within(screen.getByTestId('row-PETR4')).getByTestId('change-pill'));
    expect(pillText('PETR4').text).toBe(formatSignedCurrency(lastClose('PETR4') - barsFor('PETR4').at(-2)!.close, 'en-GB'));
    await fireEvent.press(within(screen.getByTestId('row-VALE3')).getByTestId('change-pill'));
    for (const s of STARTERS) expect(pillText(s).text).toBe(formatCompactCurrency(lastClose(s) * 1e9, 'en-GB'));
    await fireEvent.press(within(screen.getByTestId('row-PETR4')).getByTestId('change-pill'));
    expect(STARTERS.map((s) => pillText(s).text)).toEqual(pcts);
  });

  it('Missing market cap: that row has an empty-styled pill and the others show market cap', async () => {
    indexData = [...fullIndex().filter((c) => (c as { tickers: string[] }).tickers[0] !== 'ITUB4'), company(['ITUB4'], 'Itau', null)];
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    await fireEvent.press(within(screen.getByTestId('row-PETR4')).getByTestId('change-pill'));
    await fireEvent.press(within(screen.getByTestId('row-PETR4')).getByTestId('change-pill'));
    const empty = pillText('ITUB4');
    expect(empty.text).toBe('');
    expect(JSON.stringify(empty.pill.props.style)).toContain(lightPalette.surface);
    expect(pillText('PETR4').text).toBe(formatCompactCurrency(lastClose('PETR4') * 1e9, 'en-GB'));
  });

  it('Screen reader: one element reading ticker, name, price and signed change', async () => {
    mockLocale = 'pt-BR';
    specs.PETR4 = { closes: [99, 100, 101.2], volume: 1 };
    await renderList();
    await waitFor(() => expect(within(screen.getByTestId('row-PETR4')).queryByTestId('change-pill')).toBeTruthy());
    const row = screen.getByTestId('row-PETR4');
    expect(row.props.accessible).toBe(true);
    expect(row.props.accessibilityLabel).toBe(`PETR4, Petrobras, ${formatCurrency(101.2, 'pt-BR')}, up 1,2 percent`);
  });

  it('reads "down" for a falling stock', async () => {
    specs.VALE3 = { closes: [100, 99.2], volume: 1 };
    await renderList();
    await waitFor(() => expect(within(screen.getByTestId('row-VALE3')).queryByTestId('change-pill')).toBeTruthy());
    expect(screen.getByTestId('row-VALE3').props.accessibilityLabel).toMatch(/^VALE3, Vale, .*, down 0\.8 percent$/);
  });

  it('Company with a logo: the row shows the logo image beside the ticker, and the label is unchanged', async () => {
    await renderList();
    await waitFor(() => expect(within(screen.getByTestId('row-PETR4')).queryByTestId('change-pill')).toBeTruthy());
    const row = within(screen.getByTestId('row-PETR4'));
    expect(row.getByTestId('company-logo', HIDDEN).props.source).toEqual([{ uri: 'https://example.com/logos/petr.png' }]);
    await act(async () => {
      fireEvent(row.getByTestId('company-logo', HIDDEN), 'load', { nativeEvent: {} });
    });
    expect(row.queryByTestId('company-logo-initials', HIDDEN)).toBeNull();
    expect(screen.getByTestId('row-PETR4').props.accessibilityLabel).toMatch(/^PETR4, Petrobras, /);
  });

  it('No logo: initials in a circle of the same size, for a company without a logo and for a failed load', async () => {
    indexData = fullIndex(['VALE3'], [{ ...(company(['VALE3'], 'Vale') as object), image_url: null }]);
    await renderList();
    await waitFor(() => expect(within(screen.getByTestId('row-VALE3')).queryByTestId('change-pill')).toBeTruthy());
    const vale = within(screen.getByTestId('row-VALE3'));
    expect(vale.queryByTestId('company-logo', HIDDEN)).toBeNull();
    expect(vale.getByText('VA', HIDDEN)).toBeTruthy();
    expect(StyleSheet.flatten(vale.getByTestId('company-logo-box', HIDDEN).props.style)).toMatchObject({ width: 36, height: 36, borderRadius: 18 });

    const petr = within(screen.getByTestId('row-PETR4'));
    await act(async () => {
      fireEvent(petr.getByTestId('company-logo', HIDDEN), 'error', { nativeEvent: {} });
    });
    expect(petr.queryByTestId('company-logo', HIDDEN)).toBeNull();
    expect(petr.getByText('PE', HIDDEN)).toBeTruthy();
    expect(screen.getByTestId('row-PETR4').props.accessibilityLabel).toMatch(/^PETR4, Petrobras, /);
  });

  it('opens the details of the tapped stock', async () => {
    await renderList();
    await waitFor(() => expect(screen.getByTestId('row-PETR4')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('row-PETR4'));
    expect(mockPush).toHaveBeenCalledWith('/stock/PETR4');
  });
});

// --- Header (6.3) -------------------------------------------------------------------------------
describe('header', () => {
  it('Header after load: iOS shows the large title, the search bar, and "At close, 25 Nov"', async () => {
    await renderList();
    expect(await screen.findByText(`At close, ${formatShortDate('2025-11-25', 'en-GB')}`)).toBeTruthy();
    expect(screen.getByText('At close, 25 Nov')).toBeTruthy();
    expect(mockScreenOptions).toMatchObject({ headerLargeTitle: true });
    expect(mockScreenOptions.headerSearchBarOptions).toMatchObject({ placeholder: 'Search', hideWhenScrolling: true });
  });

  it('takes the subtitle from the newest last-bar date among the loaded rows', async () => {
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    expect(screen.getAllByText('At close, 25 Nov').length).toBe(1);
  });

  it('Header after load: Android shows the "Stocks" title and a pinned search field', async () => {
    Platform.OS = 'android';
    await renderList();
    expect(await screen.findByText('Stocks')).toBeTruthy();
    expect(await screen.findByText('At close, 25 Nov')).toBeTruthy();
    expect(screen.getByLabelText('Search')).toBeTruthy();
  });

  it('dismisses the keyboard on scroll', async () => {
    await renderList();
    await screen.findByText('At close, 25 Nov');
    const list = screen.getByTestId('stock-list');
    expect(list.props.keyboardDismissMode).toBe('on-drag');
  });

  it('Refresh indicator: shows while due histories reload, then hides', async () => {
    await seedFiles(20 * 60_000);
    let release: () => void = () => {};
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    expect(requests.filter((r) => r.startsWith('price:'))).toEqual([]); // fresh files: no price request
    priceGate = new Promise<void>((r) => (release = r));
    gated = () => true;
    const list = screen.getByTestId('stock-list');
    await act(async () => {
      list.props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(screen.getByTestId('stock-list').props.refreshControl.props.refreshing).toBe(true));
    release();
    await waitFor(() => expect(screen.getByTestId('stock-list').props.refreshControl.props.refreshing).toBe(false));
    expect(requests.filter((r) => r.startsWith('price:')).length).toBe(15);
  });

  it('pull to refresh within 15 minutes makes no price request', async () => {
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    requests = [];
    await act(async () => {
      screen.getByTestId('stock-list').props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(screen.getByTestId('stock-list').props.refreshControl.props.refreshing).toBe(false));
    expect(requests).toEqual([]);
  });
});

// --- Search (6.4) -------------------------------------------------------------------------------
describe('search', () => {
  async function withIndex() {
    const utils = await renderList();
    await waitFor(() => expect(rowIds().length).toBe(15));
    return utils;
  }

  it('Ticker prefix: rows for PETR3 and PETR4 appear 300 ms after the last keystroke', async () => {
    await withIndex();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    try {
      await typeInSearch('PET');
      await typeInSearch('PETR');
      await act(async () => void jest.advanceTimersByTime(299));
      expect(screen.queryByTestId('row-PETR3')).toBeNull();
      await act(async () => void jest.advanceTimersByTime(1));
      expect(screen.getByTestId('row-PETR3')).toBeTruthy();
      expect(screen.getByTestId('row-PETR4')).toBeTruthy();
      expect(rowIds()).toEqual(['PETR3', 'PETR4']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('Company name: "petrobras" lists the Petrobras tickers', async () => {
    await withIndex();
    await typeInSearch('petrobras');
    // name matches sort by company name ("Petrobras" before "Petrobras ON"), then symbol
    await waitFor(() => expect(rowIds()).toEqual(['PETR4', 'PETR3']));
    expect(screen.getByTestId('row-PETR4').props.accessibilityLabel).toMatch(/^PETR4, Petrobras/);
  });

  it('Name search on a cold start: results come from the server name search', async () => {
    let release: () => void = () => {};
    indexGate = new Promise<void>((r) => (release = r));
    searchData = [company(['VALE3'], 'Vale')];
    await renderList();
    await typeInSearch('Vale do Rio');
    await waitFor(() => expect(rowIds()).toEqual(['VALE3']));
    expect(requests).toContain('companies?search');
    release();
  });

  it('Name search on a cold start: "Vale" (capitalised, no space) goes to the server too', async () => {
    let release: () => void = () => {};
    indexGate = new Promise<void>((r) => (release = r));
    searchData = [company(['VALE3'], 'Vale')];
    await renderList();
    await typeInSearch('Vale');
    await waitFor(() => expect(rowIds()).toEqual(['VALE3']));
    expect(requests).toContain('companies?search');
    release();
  });

  it('when the index fails to load, a ticker-shaped query uses the server search and the banner offers Retry', async () => {
    indexFails = true;
    searchData = [company(['PETR4'], 'Petrobras')];
    await renderList();
    await typeInSearch('PETR4');
    await waitFor(() => expect(rowIds()).toEqual(['PETR4']));
    expect(requests).toContain('companies?search');
    expect(screen.getByLabelText('Retry')).toBeTruthy();
  });

  it('a ticker-shaped query waits for the index instead of calling the server', async () => {
    let release: () => void = () => {};
    indexGate = new Promise<void>((r) => (release = r));
    await renderList();
    await typeInSearch('PETR');
    await act(async () => new Promise((r) => setTimeout(r, 400)));
    expect(requests).not.toContain('companies?search');
    expect(screen.getAllByTestId('skeleton-row', HIDDEN).length).toBe(8);
    release();
    await waitFor(() => expect(rowIds()).toEqual(['PETR3', 'PETR4']));
  });

  it('Cancel (iOS): clears the query and brings the starter list back', async () => {
    await withIndex();
    await typeInSearch('PETR');
    await waitFor(() => expect(rowIds()).toEqual(['PETR3', 'PETR4']));
    await act(async () => {
      (mockScreenOptions.headerSearchBarOptions as { onCancelButtonPress: () => void }).onCancelButtonPress();
    });
    await waitFor(() => expect(rowIds().length).toBe(15));
  });

  it('Cancel (Android): the field empties and the starter list returns', async () => {
    Platform.OS = 'android';
    await withIndex();
    await fireEvent.changeText(screen.getByLabelText('Search'), 'PETR');
    await waitFor(() => expect(rowIds()).toEqual(['PETR3', 'PETR4']));
    await fireEvent.press(screen.getByLabelText('Cancel'));
    expect(screen.getByLabelText('Search').props.value).toBe('');
    await waitFor(() => expect(rowIds().length).toBe(15));
  });
});

// --- States (6.5) -------------------------------------------------------------------------------
describe('states', () => {
  it('shows 8 skeleton rows while loading', async () => {
    indexGate = new Promise(() => {});
    await renderList();
    expect(await screen.findAllByTestId('skeleton-row', HIDDEN)).toHaveLength(8);
    expect(rowIds()).toEqual([]);
  });

  it('Empty search: echoes the query', async () => {
    await renderList();
    await waitFor(() => expect(rowIds().length).toBe(15));
    await typeInSearch('zzzz');
    expect(await screen.findByText('No results for "zzzz"')).toBeTruthy();
  });

  it('Error with cache: a failed refresh shows a banner with Retry above the cached rows, and Retry recovers', async () => {
    await seedFiles(20 * 60_000);
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    allPricesFail = true;
    await act(async () => {
      screen.getByTestId('stock-list').props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByTestId('error-banner')).toBeTruthy();
    expect(screen.getByLabelText('Retry')).toBeTruthy();
    expect(screen.getAllByTestId('change-pill').length).toBe(15); // cached rows stay
    allPricesFail = false;
    await fireEvent.press(screen.getByLabelText('Retry'));
    await waitFor(() => expect(screen.queryByTestId('error-banner')).toBeNull());
    expect(screen.getAllByTestId('change-pill').length).toBe(15);
  });

  it('one failed history does not fail the rest of a refresh', async () => {
    await seedFiles(20 * 60_000);
    await renderList();
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    priceFails.VALE3 = 500;
    await act(async () => {
      screen.getByTestId('stock-list').props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByTestId('error-banner')).toBeTruthy();
    expect(requests.filter((r) => r.startsWith('price:')).length).toBe(15);
  });

  it('shows an error banner with Retry when a first load fails, and Retry loads the row', async () => {
    priceFails.VALE3 = 500;
    await renderList();
    expect(await screen.findByTestId('error-banner')).toBeTruthy();
    await waitFor(() => expect(rowIds().length).toBe(14));
    priceFails = {};
    await fireEvent.press(screen.getByLabelText('Retry'));
    await waitFor(() => expect(rowIds()).toContain('VALE3'));
    await waitFor(() => expect(screen.queryByTestId('error-banner')).toBeNull());
  });

  it('Launch offline: cached rows and their session date show with no network', async () => {
    await seedFiles(2 * 86_400_000);
    allPricesFail = true;
    const qc = createQueryClient({ retryDelay: () => 0 });
    qc.setQueryData(companyIndexKey, []);
    await renderList(qc);
    await waitFor(() => expect(screen.getAllByTestId('change-pill').length).toBe(15));
    expect(screen.getByText('At close, 25 Nov')).toBeTruthy();
    expect(screen.getByTestId('row-PETR4')).toBeTruthy();
  });
});
