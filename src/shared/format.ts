// Locale formatting (design D13): Intl with the device locale; currency is always BRL.
import { getLocales } from 'expo-localization';

const FALLBACK_LOCALE = 'en-US';

export function deviceLocale(): string {
  try {
    return getLocales()[0]?.languageTag ?? FALLBACK_LOCALE;
  } catch {
    return FALLBACK_LOCALE;
  }
}

// Intl formatters are costly to build (list rows and chart scrubbing format on every render) and
// stateless, so one is kept per locale and options.
const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = numberFormats.get(key);
  if (!f) numberFormats.set(key, (f = new Intl.NumberFormat(locale, options)));
  return f;
}

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = dateFormats.get(key);
  if (!f) dateFormats.set(key, (f = new Intl.DateTimeFormat(locale, options)));
  return f;
}

/** "R$ 37,85" in pt-BR. */
export function formatCurrency(value: number, locale: string = deviceLocale()): string {
  return numberFormat(locale, { style: 'currency', currency: 'BRL' }).format(value);
}

/** A plain number with at most `maxDigits` decimals: 1.2 -> "1,2" in pt-BR. */
export function formatDecimal(value: number, maxDigits: number, locale: string = deviceLocale()): string {
  return numberFormat(locale, { maximumFractionDigits: maxDigits }).format(value);
}

const MINUS = '\u2212';

/**
 * Prefixes the formatted magnitude with "+" or the minus sign. Written by hand: Hermes's `Intl`
 * can ignore `signDisplay`. A value that rounds to zero carries no sign.
 */
function withSign(value: number, digits: number, format: (magnitude: number) => string): string {
  const magnitude = Math.abs(value);
  const text = format(magnitude);
  if (Math.round(magnitude * 10 ** digits) === 0) return text;
  return `${value > 0 ? '+' : MINUS}${text}`;
}

/** A fraction as a percentage: 0.012 -> "+1.20%", -0.012 -> "\u22121.20%". Pass `signed: false` for plain values. */
export function formatPercent(
  fraction: number,
  { signed = true, digits = 2, locale = deviceLocale() }: { signed?: boolean; digits?: number; locale?: string } = {},
): string {
  const fmt = numberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return signed ? withSign(fraction, digits + 2, (m) => fmt.format(m)) : fmt.format(fraction);
}

/** A signed currency change: +0.44 -> "+R$ 0,44". */
export function formatSignedCurrency(value: number, locale: string = deviceLocale()): string {
  return withSign(value, 2, (m) => formatCurrency(m, locale));
}

/** Compact currency, for market caps: "R$ 493.7B" (en-US), "R$ 493,7 bi" (pt-BR). */
export function formatCompactCurrency(value: number, locale: string = deviceLocale()): string {
  return numberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** Compact plain number, for volumes: 12,300,000 -> "12.3M". */
export function formatCompactNumber(value: number, locale: string = deviceLocale()): string {
  return numberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Short day and month of a `YYYY-MM-DD` (or ISO date-time) date: "25 Nov" in en-GB, "Nov 25" in en-US. */
export function formatShortDate(isoDate: string, locale: string = deviceLocale()): string {
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`);
  return dateFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
}
