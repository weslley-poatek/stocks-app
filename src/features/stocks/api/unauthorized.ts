// A tiny pub/sub so any 401 reaches the key context without each screen wiring it (spec: Rejected key).

type Listener = (key: string) => void;
const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called with the key the rejected request used. The listener decides whether it is the stored key. */
export function notifyUnauthorized(key: string) {
  listeners.forEach((l) => l(key));
}
