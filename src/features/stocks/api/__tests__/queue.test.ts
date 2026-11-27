import { ApiError } from '../client-error';
import { Priority, RequestQueue } from '../queue';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

const flush = async (ms: number) => {
  await jest.advanceTimersByTimeAsync(ms);
};

describe('RequestQueue', () => {
  it('never puts more than the limit in any 60 s window', async () => {
    const q = new RequestQueue({ limit: 25 });
    const sends: number[] = [];
    const jobs = Array.from({ length: 40 }, () =>
      q.enqueue(Priority.visible, async () => {
        sends.push(Date.now());
      }),
    );
    await flush(0);
    expect(sends).toHaveLength(25);
    await flush(120_000);
    await Promise.all(jobs);
    expect(sends).toHaveLength(40);
    for (const s of sends) {
      expect(sends.filter((t) => t >= s && t < s + 60_000).length).toBeLessThanOrEqual(25);
    }
  });

  it('defaults to 10 a minute until configured', async () => {
    const q = new RequestQueue();
    let n = 0;
    for (let i = 0; i < 15; i++) void q.enqueue(1, async () => void n++);
    await flush(0);
    expect(n).toBe(10);
    q.configure({ limit: 25 });
    await flush(0);
    expect(n).toBe(15);
  });

  it('runs by priority, then arrival', async () => {
    const q = new RequestQueue({ limit: 1 });
    const order: string[] = [];
    const add = (name: string, p: number) => q.enqueue(p, async () => void order.push(name));
    const first = add('first', Priority.visible); // takes the only slot
    const all = [
      add('dividends', Priority.dividends),
      add('offscreen', Priority.offscreen),
      add('visible-1', Priority.visible),
      add('keyCheck', Priority.keyCheck),
      add('visible-2', Priority.visible),
    ];
    await flush(5 * 60_000);
    await Promise.all([first, ...all]);
    expect(order).toEqual(['first', 'keyCheck', 'visible-1', 'visible-2', 'offscreen', 'dividends']);
  });

  it('pauses on a 429 until resets_at, then retries the job', async () => {
    const q = new RequestQueue({ limit: 25 });
    const attempts: number[] = [];
    const start = Date.now();
    const limited = q.enqueue(1, async () => {
      attempts.push(Date.now() - start);
      if (attempts.length === 1) throw new ApiError('rateLimited', 429, 30_000);
      return 'ok';
    });
    const other: number[] = [];
    await flush(0);
    expect(attempts).toEqual([0]);
    const second = q.enqueue(2, async () => void other.push(Date.now() - start));
    await flush(0);
    expect(other).toEqual([]); // the whole queue is paused
    await flush(29_000);
    expect(attempts).toHaveLength(1);
    await flush(1_500);
    expect(await limited).toBe('ok');
    await second;
    expect(attempts[1]).toBeGreaterThanOrEqual(30_000);
    expect(other[0]).toBeGreaterThanOrEqual(30_000);
  });

  it('falls back to the known minute reset, then to 60 s', async () => {
    const q = new RequestQueue();
    q.configure({ minuteResetsAt: new Date(Date.now() + 10_000).toISOString() });
    let n = 0;
    const p = q.enqueue(1, async () => {
      if (n++ === 0) throw new ApiError('rateLimited', 429);
    });
    await flush(9_000);
    expect(n).toBe(1);
    await flush(1_500);
    await p;
    expect(n).toBe(2);

    const q2 = new RequestQueue();
    let m = 0;
    const p2 = q2.enqueue(1, async () => {
      if (m++ === 0) throw new ApiError('rateLimited', 429);
    });
    await flush(59_000);
    expect(m).toBe(1);
    await flush(1_500);
    await p2;
    expect(m).toBe(2);
  });

  it('rejects other errors without retrying', async () => {
    const q = new RequestQueue();
    const run = jest.fn().mockRejectedValue(new ApiError('notFound', 404));
    await expect(q.enqueue(1, run)).rejects.toMatchObject({ kind: 'notFound' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('drops a waiting job whose signal is aborted without taking a slot', async () => {
    const q = new RequestQueue({ limit: 1 });
    const ran: string[] = [];
    const first = q.enqueue(1, async () => void ran.push('first'));
    const ac = new AbortController();
    const aborted = q.enqueue(1, async () => void ran.push('aborted'), ac.signal);
    const caught = aborted.catch((e) => e);
    const last = q.enqueue(1, async () => void ran.push('last'));
    ac.abort();
    await flush(61_000);
    await Promise.all([first, last]);
    await caught;
    expect(ran).toEqual(['first', 'last']);
    // 'last' ran in the second window right after 'first': the aborted job took no slot between them
    expect(await caught).toBeDefined();
  });
});
