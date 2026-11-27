import { appCacheStore } from './persister';
import { STARTERS } from './starter';

const KEY = 'starter-order';

/** The last session's volume order (design D9), or the starter order on a first run. */
export function readStarterOrder(): string[] {
  let saved: unknown;
  try {
    saved = JSON.parse(appCacheStore().getString(KEY) ?? 'null');
  } catch {
    saved = null;
  }
  const known = Array.isArray(saved)
    ? saved.filter((s): s is string => typeof s === 'string' && (STARTERS as readonly string[]).includes(s))
    : [];
  return [...known, ...STARTERS.filter((s) => !known.includes(s))];
}

export function writeStarterOrder(order: readonly string[]): void {
  try {
    appCacheStore().set(KEY, JSON.stringify(order));
  } catch {
    // the order is a convenience; losing it only costs one re-sort
  }
}
