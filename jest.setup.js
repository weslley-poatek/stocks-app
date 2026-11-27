// See jest.environment.js: use Node's fetch so msw can intercept the API client's requests.
for (const [name, value] of Object.entries(globalThis.__nodeFetchGlobals)) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

require('@shopify/flash-list/jestSetup');

// Query garbage-collection timers last 7 days (gcTime). Unref them so a test that never unmounts
// its QueryClient doesn't keep the Jest worker alive ("failed to exit gracefully").
const { timeoutManager } = require('@tanstack/query-core');
const unref = (t) => (t && typeof t === 'object' && t.unref?.(), t);
timeoutManager.setTimeoutProvider({
  setTimeout: (cb, ms) => unref(setTimeout(cb, ms)),
  clearTimeout: (t) => clearTimeout(t),
  setInterval: (cb, ms) => unref(setInterval(cb, ms)),
  clearInterval: (t) => clearInterval(t),
});

jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn(async () => '') }));

// Native modules are mocked with in-memory fakes. Tests reach them through `__reset()`.
jest.mock('expo-file-system', () => {
  const files = new Map();
  const dirs = new Set();
  const join = (parts) =>
    parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/').replace(/\/+/g, '/');
  class Directory {
    constructor(...parts) {
      this.uri = join(parts);
    }
    get exists() {
      return dirs.has(this.uri);
    }
    create() {
      dirs.add(this.uri);
    }
    delete() {
      dirs.delete(this.uri);
      for (const k of [...files.keys()]) if (k.startsWith(`${this.uri}/`)) files.delete(k);
    }
  }
  class File {
    constructor(...parts) {
      this.uri = join(parts);
    }
    get exists() {
      return files.has(this.uri);
    }
    create() {
      if (!files.has(this.uri)) files.set(this.uri, '');
    }
    write(content) {
      files.set(this.uri, content);
    }
    async text() {
      if (!files.has(this.uri)) throw new Error('File does not exist');
      return files.get(this.uri);
    }
    delete() {
      files.delete(this.uri);
    }
  }
  return {
    Directory,
    File,
    Paths: { document: new Directory('file:///documents') },
    __files: files,
    __reset: () => {
      files.clear();
      dirs.clear();
    },
  };
});

jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  return {
    createMMKV: ({ id = 'default' } = {}) => {
      if (!stores.has(id)) stores.set(id, new Map());
      const m = stores.get(id);
      return {
        getString: (k) => m.get(k),
        set: (k, v) => void m.set(k, v),
        remove: (k) => m.delete(k),
        clearAll: () => m.clear(),
        getAllKeys: () => [...m.keys()],
      };
    },
  };
});
