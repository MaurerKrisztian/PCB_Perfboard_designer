// The Compression Streams API, which this TypeScript version's DOM lib predates. Every current
// browser has it, and so does Node 18+. Used by src/project-file/share-link.ts.

type CompressionFormat = "deflate" | "deflate-raw" | "gzip";

declare class CompressionStream {
  constructor(format: CompressionFormat);
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}

declare class DecompressionStream {
  constructor(format: CompressionFormat);
  readonly readable: ReadableStream<Uint8Array>;
  readonly writable: WritableStream<Uint8Array>;
}
