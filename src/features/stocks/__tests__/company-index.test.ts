import type { QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import page from '../api/__fixtures__/companies-page.json';
import { BASE_URL } from '../api/client';
import { companyIndexKey, companyIndexQueryOptions } from '../company-index';
import { createQueryClient } from '../query-client';

const ensureCompanyIndex = (qc: QueryClient, key: string) => qc.fetchQuery(companyIndexQueryOptions(key));

const DAY = 86_400_000;
const server = setupServer();
let urls: URL[] = [];
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());
beforeEach(() => {
  urls = [];
  server.use(
    http.get(`${BASE_URL}/v1/companies`, ({ request }) => {
      const url = new URL(request.url);
      urls.push(url);
      return HttpResponse.json({ ...page, page: Number(url.searchParams.get('page')), limit: 100, total: 250 });
    }),
  );
});

describe('company index', () => {
  it('fetches every page once, BR only, 100 at a time', async () => {
    const qc = createQueryClient();
    const index = await ensureCompanyIndex(qc, 'idk_test1234');
    expect(urls.map((u) => u.searchParams.get('page')).sort()).toEqual(['1', '2', '3']);
    for (const u of urls) {
      expect(u.searchParams.get('country_code')).toBe('BR');
      expect(u.searchParams.get('limit')).toBe('100');
    }
    expect(index.length).toBe(page.data.length * 3);
    await ensureCompanyIndex(qc, 'idk_test1234');
    expect(urls.length).toBe(3);
  });
  it('makes no request at 3 days old', async () => {
    const qc = createQueryClient();
    qc.setQueryData(companyIndexKey, [], { updatedAt: Date.now() - 3 * DAY });
    await ensureCompanyIndex(qc, 'idk_test1234');
    expect(urls.length).toBe(0);
  });
  it('refetches past 7 days', async () => {
    const qc = createQueryClient();
    qc.setQueryData(companyIndexKey, [], { updatedAt: Date.now() - 8 * DAY });
    await ensureCompanyIndex(qc, 'idk_test1234');
    expect(urls.length).toBe(3);
  });
});
