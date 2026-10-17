// A .wasm file the Worker is uploaded with (build.mjs copies resvg's next to it), imported as a
// compiled module: Workers can't compile WebAssembly at run time.
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

// The Workers runtime's own cache, at each data center (the Cache API's caches.default).
interface CacheStorage {
  readonly default: Cache;
}

// What a Worker's fetch handler is handed besides the request: waitUntil keeps it running for work
// left after the response, such as filling the cache.
interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

// The little of the Workers runtime worker.ts uses. Declared here rather than taken from
// @cloudflare/workers-types, whose globals clash with the DOM and Node types the rest of the
// server is checked against.
declare module "cloudflare:workers" {
  interface DurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    deleteAll(): Promise<void>;
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number): Promise<void>;
  }

  interface DurableObjectState {
    storage: DurableObjectStorage;
  }

  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState;
    protected env: Env;
    constructor(ctx: DurableObjectState, env: Env);
  }

  interface DurableObjectId {
    toString(): string;
  }

  // A stub calls the object's methods over RPC; theirs all return promises already.
  export interface DurableObjectNamespace<T> {
    idFromName(name: string): DurableObjectId;
    get(id: DurableObjectId): T;
  }
}
