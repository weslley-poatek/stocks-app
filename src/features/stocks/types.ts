// Domain models shared by the API mappers, the derivations and the screens.
// Screens use these types, never raw API responses (spec: Mapping).

/** One daily bar. `t` is in milliseconds (design D7); arrays of bars are sorted ascending by `t`. */
export type Bar = {
  t: number;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  adjusted?: number;
};

/** One payout. `exDate` is `YYYY-MM-DD`. */
export type Dividend = { exDate: string; amount: number };

export type Range = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y' | 'ALL';

export type Plan = 'free' | 'pro' | 'business' | 'admin';

/** From `GET /v1/usage`. The plan maps from the API's `role` (design D15). */
export type KeyStatus = {
  keyPrefix: string;
  plan: Plan;
  perMinute?: number;
  perDay?: number;
  remainingToday?: number;
  /** ISO date-time of the minute window's reset, when the API sends one. */
  minuteResetsAt?: string;
};

/** From a company record. Nullable API fields become absent (`undefined`). */
export type Company = {
  id: string;
  name: string; // display_name
  legalName: string;
  logoUrl?: string;
  tickers: string[];
  totalShares?: number;
  sector?: string;
  subsector?: string;
  segment?: string;
};

/** From `GET /v1/tickers/{symbol}`. `companyId` is absent when the API returns null. */
export type TickerInfo = { symbol: string; companyId?: string };

export type StockSummary = {
  symbol: string;
  name: string;
  logoUrl?: string;
  close: number;
  change?: number;
  changePct?: number;
  marketCap?: number; // approximate
  asOf: string; // session date, `YYYY-MM-DD`
};

export type StockDetails = StockSummary & {
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  avgVolume?: number;
  high52w?: number;
  low52w?: number;
  dividendYield?: number; // trailing 12 months
  sector?: string;
  subsector?: string;
  segment?: string;
  legalName?: string;
};
