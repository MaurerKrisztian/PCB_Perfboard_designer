// A .wasm file the Worker is uploaded with (build.mjs copies resvg's next to it), imported as a
// compiled module: Workers can't compile WebAssembly at run time.
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

// The little of the Workers runtime worker.ts uses. Declared here rather than taken from
// @cloudflare/workers-types, whose globals clash with the DOM and Node types the rest of the
// server is checked against.
declare module "cloudflare:workers" {
  interface DurableObjectStorage {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
    deleteAll(): Promise<void>;
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
