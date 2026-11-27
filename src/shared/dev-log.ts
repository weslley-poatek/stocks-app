// Development-only logging. Silent in release builds and under Jest (set STOCKS_DEV_LOG=1 in a
// test that needs to see the lines).
export function devLog(message: string): void {
  if (!__DEV__) return;
  const env = typeof process !== 'undefined' ? process.env : undefined;
  if (env?.JEST_WORKER_ID !== undefined && env?.STOCKS_DEV_LOG === undefined) return;
  console.log(message);
}
