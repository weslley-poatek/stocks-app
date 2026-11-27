// Typed API errors (design D5). Kept apart from client.ts so the queue can import it without a cycle.
export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'rateLimited'
  | 'network'
  | 'invalidResponse'
  | 'unknown';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status?: number,
    /** For `rateLimited`: how long the server asked us to wait, when it said. */
    readonly retryAfterMs?: number,
    /** For `invalidResponse`: the first schema issues (paths and messages, never values). For diagnostics. */
    readonly detail?: string,
  ) {
    super(`API ${kind}${status ? ` (${status})` : ''}`);
    this.name = 'ApiError';
  }
}

/** Whether `e` is an `ApiError` of the given kind. */
export function isApiError(e: unknown, kind: ApiErrorKind): e is ApiError {
  return e instanceof ApiError && e.kind === kind;
}
