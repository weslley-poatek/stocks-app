import { z } from 'zod';

// Response schemas, from the OpenAPI document (design D15). Unknown keys are ignored.

const windowSchema = z.object({
  limit: z.number(),
  used: z.number(),
  remaining: z.number(),
  resets_at: z.string().nullish(),
});

export const usageSchema = z.object({
  key_prefix: z.string(),
  role: z.enum(['admin', 'free', 'pro', 'business']),
  rate_limit: z.object({ minute: windowSchema, day: windowSchema }).nullable(),
  // Required by the API but not used: passed through unvalidated (D15).
  history: z.unknown().optional(),
});
export type UsageDto = z.infer<typeof usageSchema>;

export const companySchema = z.object({
  id: z.string(),
  legal_name: z.string(),
  display_name: z.string(),
  tickers: z.array(z.string()),
  image_url: z.string().nullish(),
  sector: z.string().nullish(),
  subsector: z.string().nullish(),
  segment: z.string().nullish(),
  summary: z.object({ total_shares: z.number().nullish() }).nullish(),
});
export type CompanyDto = z.infer<typeof companySchema>;

export const companiesPageSchema = z.object({
  data: z.array(companySchema),
  page: z.number(),
  limit: z.number(),
  total: z.number(),
});
export type CompaniesPageDto = z.infer<typeof companiesPageSchema>;

export const tickerSchema = z.object({
  symbol: z.string(),
  company_id: z.string().nullable(),
});
export type TickerDto = z.infer<typeof tickerSchema>;

const optionalNumber = z.number().nullish();
export const barSchema = z.object({
  timestamp: z.number().finite(),
  close: z.number().finite(),
  open: optionalNumber,
  high: optionalNumber,
  low: optionalNumber,
  volume: optionalNumber,
  adjusted: optionalNumber,
});
export type BarDto = z.infer<typeof barSchema>;

export const dividendSchema = z.object({
  ex_date: z.string(),
  amount: z.number(),
  date: z.number().nullish(),
});
export const dividendsSchema = z.array(dividendSchema);
export type DividendDto = z.infer<typeof dividendSchema>;

/** Release builds check the first and last 50 bars of a history; development builds check all (D7). */
export const SAMPLE_SIZE = 50;

export function parsePrice(body: unknown, full: boolean = __DEV__): BarDto[] {
  const arr = z.array(z.unknown()).parse(body);
  const toCheck =
    full || arr.length <= SAMPLE_SIZE * 2
      ? arr
      : [...arr.slice(0, SAMPLE_SIZE), ...arr.slice(-SAMPLE_SIZE)];
  for (const bar of toCheck) barSchema.parse(bar);
  return arr as BarDto[];
}
