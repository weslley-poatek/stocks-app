// One file per symbol under documentDirectory/prices/, with its fetch time (design D6).
import { Directory, File, Paths } from 'expo-file-system';

import type { Bar } from './types';

export const STALE_AFTER_MS = 12 * 3_600_000;
export const REFRESH_FLOOR_MS = 15 * 60_000;

export type StoredHistory = { bars: Bar[]; fetchedAt: number };

const dir = () => new Directory(Paths.document, 'prices');
const fileFor = (symbol: string) => new File(dir(), `${encodeURIComponent(symbol)}.json`);

const isStored = (v: unknown): v is StoredHistory =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as StoredHistory).fetchedAt === 'number' &&
  Array.isArray((v as StoredHistory).bars);

/** The stored history, or undefined when there is none or the file is unreadable. */
export async function readHistory(symbol: string): Promise<StoredHistory | undefined> {
  try {
    const file = fileFor(symbol);
    if (!file.exists) return undefined;
    const parsed: unknown = JSON.parse(await file.text());
    return isStored(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export async function writeHistory(symbol: string, bars: Bar[], fetchedAt: number = Date.now()): Promise<void> {
  const d = dir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true });
  const file = fileFor(symbol);
  if (!file.exists) file.create({ intermediates: true });
  file.write(JSON.stringify({ bars, fetchedAt } satisfies StoredHistory));
}

/** Launch rule: refetch only when older than 12 hours. */
export const isStale = (fetchedAt: number, now: number = Date.now()): boolean =>
  now - fetchedAt > STALE_AFTER_MS;

/** Pull-to-refresh rule: refetch only when the last fetch is 15 minutes old or more. */
export const canRefresh = (fetchedAt: number, now: number = Date.now()): boolean =>
  now - fetchedAt >= REFRESH_FLOOR_MS;
