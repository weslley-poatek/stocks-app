import { devLog } from '@/shared/dev-log';
import { isApiError } from './client-error';

// Sliding-window request queue (design D4).

/** Lower runs first: key check, visible rows, off-screen rows, dividends. */
export const Priority = { keyCheck: 0, visible: 1, offscreen: 2, dividends: 3 } as const;

export const DEFAULT_LIMIT = 10;
const WINDOW_MS = 60_000;
const FALLBACK_PAUSE_MS = 60_000;
const MAX_RATE_LIMIT_RETRIES = 3;

type Job = {
  priority: number;
  seq: number;
  run: () => Promise<unknown>;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  retries: number;
  signal?: AbortSignal;
};

export class RequestQueue {
  private limit: number;
  private readonly now: () => number;
  private sends: number[] = [];
  private waiting: Job[] = [];
  private seq = 0;
  private pausedUntil = 0;
  private minuteResetsAt: number | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(opts: { limit?: number; now?: () => number } = {}) {
    this.limit = opts.limit ?? DEFAULT_LIMIT;
    this.now = opts.now ?? Date.now;
  }

  /** Called with `/v1/usage` figures. A missing limit keeps the current one. */
  configure(opts: { limit?: number; minuteResetsAt?: string }) {
    if (opts.limit !== undefined && opts.limit > 0) {
      this.limit = opts.limit;
      devLog(`[req] limit=${this.limit}`);
    }
    if (opts.minuteResetsAt) {
      const t = Date.parse(opts.minuteResetsAt);
      this.minuteResetsAt = Number.isNaN(t) ? undefined : t;
    }
    this.pump();
  }

  enqueue<T>(priority: number, run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.waiting.push({
        signal,
        priority,
        seq: this.seq++,
        run,
        resolve: resolve as (v: unknown) => void,
        reject,
        retries: 0,
      });
      this.pump();
    });
  }

  private pump() {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    for (;;) {
      if (this.waiting.length === 0) return;
      const now = this.now();
      if (now < this.pausedUntil) return this.wakeAt(this.pausedUntil);
      while (this.sends.length > 0 && this.sends[0] <= now - WINDOW_MS) this.sends.shift();
      if (this.sends.length >= this.limit) return this.wakeAt(this.sends[0] + WINDOW_MS);
      const job = this.take();
      if (job.signal?.aborted) {
        // Cancelled while waiting: no slot is spent on it.
        job.reject(job.signal.reason ?? new DOMException('Aborted', 'AbortError'));
        continue;
      }
      this.start(job, now);
    }
  }

  private wakeAt(t: number) {
    this.timer = setTimeout(() => this.pump(), Math.max(0, t - this.now()));
    // Don't keep a Node process (tests) alive for a wait; a no-op in React Native.
    (this.timer as { unref?: () => void }).unref?.();
  }

  private take(): Job {
    let best = 0;
    for (let i = 1; i < this.waiting.length; i++) {
      const a = this.waiting[i];
      const b = this.waiting[best];
      if (a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq)) best = i;
    }
    return this.waiting.splice(best, 1)[0];
  }

  private start(job: Job, now: number) {
    this.sends.push(now);
    job.run().then(
      (v) => job.resolve(v),
      (e) => {
        if (isApiError(e, 'rateLimited') && job.retries < MAX_RATE_LIMIT_RETRIES) {
          job.retries++;
          const t = this.now();
          const wait =
            e.retryAfterMs ??
            (this.minuteResetsAt !== undefined && this.minuteResetsAt > t
              ? this.minuteResetsAt - t
              : FALLBACK_PAUSE_MS);
          this.pausedUntil = Math.max(this.pausedUntil, t + wait);
          this.waiting.push(job); // keeps its priority and arrival order
          this.pump();
        } else {
          job.reject(e);
        }
      },
    );
  }
}

export const apiQueue = new RequestQueue();
