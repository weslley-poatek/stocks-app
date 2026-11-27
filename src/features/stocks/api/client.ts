import { ZodError, type ZodType } from 'zod';

import type { Bar, Company, Dividend, KeyStatus, TickerInfo } from '../types';
import { devLog } from '@/shared/dev-log';
import { ApiError } from './client-error';
import {
  mapBars,
  mapCompany,
  mapCompaniesPage,
  mapDividends,
  mapTicker,
  mapUsage,
} from './mappers';
import { Priority, type RequestQueue } from './queue';
import { notifyUnauthorized } from './unauthorized';
import {
  companiesPageSchema,
  companySchema,
  dividendsSchema,
  parsePrice,
  tickerSchema,
  usageSchema,
} from './schemas';

export { ApiError } from './client-error';
export const BASE_URL = 'https://api.investingdata.com.br';
export const PAGE_LIMIT = 100;

function kindForStatus(status: number): ApiError['kind'] {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 429) return 'rateLimited';
  return 'unknown';
}

/** Milliseconds to wait, from `Retry-After` (seconds or a date) or a `resets_at` header or body. */
async function retryAfterMs(res: Response): Promise<number | undefined> {
  const now = Date.now();
  const ra = res.headers.get('retry-after');
  if (ra) {
    const secs = Number(ra);
    if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
    const at = Date.parse(ra);
    if (!Number.isNaN(at)) return Math.max(0, at - now);
  }
  let resetsAt: string | null | undefined = res.headers.get('resets_at') ?? res.headers.get('x-resets-at');
  if (!resetsAt) {
    try {
      const body: unknown = await res.json();
      const v = (body as { resets_at?: unknown } | null)?.resets_at;
      if (typeof v === 'string') resetsAt = v;
    } catch {
      // no usable body
    }
  }
  if (resetsAt) {
    const at = Date.parse(resetsAt);
    if (!Number.isNaN(at)) return Math.max(0, at - now);
  }
  return undefined;
}

/** One HTTP GET with no queueing. Never logs the key or headers. */
export async function request<T>(
  key: string,
  path: string,
  parse: (body: unknown) => T,
  signal?: AbortSignal,
): Promise<T> {
  let res: Response;
  devLog(`[req] ${Date.now()} ${path.split('?')[0]}`);
  try {
    res = await fetch(`${BASE_URL}${path}`, { headers: { 'x-api-key': key }, signal });
  } catch {
    throw new ApiError('network');
  }
  if (!res.ok) {
    if (res.status === 401) notifyUnauthorized(key);
    throw new ApiError(
      kindForStatus(res.status),
      res.status,
      res.status === 429 ? await retryAfterMs(res) : undefined,
    );
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('invalidResponse', res.status);
  }
  try {
    return parse(body);
  } catch (e) {
    const issues = e instanceof ZodError ? e.issues.slice(0, 3) : [];
    const detail = issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || undefined;
    throw new ApiError('invalidResponse', res.status, undefined, detail);
  }
}

const withSchema = <T>(schema: ZodType<T>) => (body: unknown) => schema.parse(body);

export type CallOptions = { priority?: number; signal?: AbortSignal };

/** The typed API. Pass a queue to rate-limit its calls; leave it out to call straight through. */
export function createClient(key: string, queue?: RequestQueue) {
  const call = <T>(
    path: string,
    parse: (body: unknown) => T,
    { priority = Priority.visible, signal }: CallOptions = {},
  ): Promise<T> =>
    queue
      ? queue.enqueue(priority, () => request(key, path, parse, signal), signal)
      : request(key, path, parse, signal);

  return {
    async usage(opts?: CallOptions): Promise<KeyStatus> {
      const status = mapUsage(
        await call('/v1/usage?range=24h', withSchema(usageSchema), {
          priority: Priority.keyCheck,
          ...opts,
        }),
      );
      queue?.configure({ limit: status.perMinute, minuteResetsAt: status.minuteResetsAt });
      return status;
    },
    async companies(
      page: number,
      opts?: CallOptions,
    ): Promise<{ companies: Company[]; page: number; pageCount: number }> {
      return mapCompaniesPage(
        await call(
          `/v1/companies?country_code=BR&page=${page}&limit=${PAGE_LIMIT}`,
          withSchema(companiesPageSchema),
          opts,
        ),
      );
    },
    async company(id: string, opts?: CallOptions): Promise<Company> {
      return mapCompany(
        await call(`/v1/companies/${encodeURIComponent(id)}`, withSchema(companySchema), opts),
      );
    },
    /** The server's name search (`search` matches legal or display name), for before the index is cached. */
    async searchCompanies(query: string, opts?: CallOptions): Promise<Company[]> {
      return mapCompaniesPage(
        await call(
          `/v1/companies?country_code=BR&limit=${PAGE_LIMIT}&search=${encodeURIComponent(query)}`,
          withSchema(companiesPageSchema),
          opts,
        ),
      ).companies;
    },
    async ticker(symbol: string, opts?: CallOptions): Promise<TickerInfo> {
      return mapTicker(
        await call(`/v1/tickers/${encodeURIComponent(symbol)}`, withSchema(tickerSchema), opts),
      );
    },
    async price(symbol: string, opts?: CallOptions): Promise<Bar[]> {
      return mapBars(
        await call(`/v1/tickers/${encodeURIComponent(symbol)}/price`, (b) => parsePrice(b), opts),
      );
    },
    async dividends(symbol: string, opts?: CallOptions): Promise<Dividend[]> {
      return mapDividends(
        await call(
          `/v1/tickers/${encodeURIComponent(symbol)}/dividends`,
          withSchema(dividendsSchema),
          { priority: Priority.dividends, ...opts },
        ),
      );
    },
  };
}
