import { ApiError, type ApiErrorKind } from '../api/client-error';
import { createQueryClient } from '../query-client';

const run = async (kind: ApiErrorKind) => {
  const qc = createQueryClient({ retryDelay: () => 1 });
  const fn = jest.fn().mockRejectedValue(new ApiError(kind, kind === 'network' ? undefined : 400));
  await qc.fetchQuery({ queryKey: [kind], queryFn: fn }).catch(() => {});
  qc.clear();
  return fn.mock.calls.length;
};

describe('query client', () => {
  it('makes exactly 3 attempts on a network failure', async () => {
    expect(await run('network')).toBe(3);
  });
  it.each(['unauthorized', 'forbidden', 'notFound', 'rateLimited', 'invalidResponse', 'unknown'] as const)(
    'never retries %s',
    async (kind) => {
      expect(await run(kind)).toBe(1);
    },
  );
  it('turns off focus, reconnect and interval refetching', () => {
    const o = createQueryClient().getDefaultOptions().queries!;
    expect(o.refetchOnWindowFocus).toBe(false);
    expect(o.refetchOnReconnect).toBe(false);
    expect(o.refetchInterval).toBe(false);
  });
  it('backs off exponentially', () => {
    const d = createQueryClient().getDefaultOptions().queries!.retryDelay as (n: number) => number;
    expect([d(0), d(1), d(2)]).toEqual([1000, 2000, 4000]);
  });
});
