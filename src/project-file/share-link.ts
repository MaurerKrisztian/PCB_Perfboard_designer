import {ProjectFile} from "./project-file";
import {ProjectFileError} from "./read-project-file";

// Share links: a whole project carried in the editor URL's fragment (after the "#"), so sharing
// needs no server, and browsers never send the fragment to one. Documented for people and
// programs writing links in docs/share-links.md. The fragment holds an
// optional `name` and one of:
//   z=<project file as JSON, deflate-raw compressed, base64url>   what the editor makes
//   json=<project file as percent-encoded JSON>                   easy to write without tools
//   src=<http(s) address of a project file>                       a file hosted elsewhere
// Any version of the project file is accepted: the decoded value still goes through
// readProjectFile. Pure, like the rest of this folder: browsers and Node 18+ both have the
// compression streams, TextEncoder and atob/btoa it uses.

export type ShareLink =
  | {kind: "embedded"; name?: string; format: "z" | "json"; payload: string}
  | {kind: "hosted"; name?: string; url: string};

// Far beyond any real project (a big, busy board is well under 100 kB), so a hostile link can't
// make the tab unpack gigabytes.
export const MAX_SHARED_PROJECT_BYTES = 5_000_000;

const DAMAGED = "This link's project data is damaged. It may have been cut off when the link was copied.";
const TOO_BIG = "This link's project is too big to open.";
const NOT_JSON = "This link's project isn't valid JSON. In a json= link, json= has to come last, with nothing after the project.";

// The share link in a URL fragment (`location.hash`, with or without its "#"), or undefined when
// the fragment isn't one.
export function readShareFragment(hash: string): ShareLink | undefined {
  const fragment = hash.replace(/^#/, "");
  // `json` must come last and runs to the end of the fragment, so a hand-written project doesn't
  // have to escape every "&" and "=" in it.
  const jsonParam = /(^|&)json=/.exec(fragment);
  const params = new URLSearchParams(jsonParam ? fragment.slice(0, jsonParam.index) : fragment);
  const name = params.get("name")?.trim() || undefined;
  if (jsonParam) {
    return {kind: "embedded", name, format: "json", payload: fragment.slice(jsonParam.index + jsonParam[0].length)};
  }
  const z = params.get("z");
  if (z) return {kind: "embedded", name, format: "z", payload: z};
  const src = params.get("src")?.trim();
  if (src) return {kind: "hosted", name, url: src};
  return undefined;
}

// The fragment (without the "#") of a link that opens `project` as a project called `name`.
export async function makeShareFragment(project: ProjectFile, name?: string): Promise<string> {
  const compressed = await pipe(new TextEncoder().encode(JSON.stringify(project)), new CompressionStream("deflate-raw"));
  return `${name?.trim() ? `name=${encodeURIComponent(name.trim())}&` : ""}z=${bytesToBase64Url(compressed)}`;
}

// The project file an embedded link carries, parsed but not yet checked: pass it to
// readProjectFile. Throws ProjectFileError when it can't be unpacked or isn't JSON.
export async function decodeEmbeddedProject(link: Extract<ShareLink, {kind: "embedded"}>): Promise<unknown> {
  const json = link.format === "z" ? new TextDecoder().decode(await inflate(base64ToBytes(link.payload))) : percentDecode(link.payload);
  if (json.length > MAX_SHARED_PROJECT_BYTES) throw new ProjectFileError(TOO_BIG);
  try {
    return JSON.parse(json);
  } catch {
    throw new ProjectFileError(link.format === "json" ? NOT_JSON : DAMAGED);
  }
}

// Runs `bytes` through a (de)compression stream, giving up past MAX_SHARED_PROJECT_BYTES.
async function pipe(bytes: Uint8Array, transform: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  // A copy, as newer TypeScript DOM types only let ArrayBuffer-backed arrays into a Blob, and
  // `slice` makes one.
  const reader = new Blob([bytes.slice()]).stream().pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_SHARED_PROJECT_BYTES) {
      reader.cancel().catch(() => undefined);
      throw new ProjectFileError(TOO_BIG);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

// The editor writes deflate-raw, but a program writing the link by hand may well reach for zlib
// or gzip (Python's zlib.compress writes zlib), so those are read too: the one the header bytes
// point to first, then the others.
async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const looksGzip = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const looksZlib = (bytes[0] & 0x0f) === 8 && ((bytes[0] << 8) | bytes[1]) % 31 === 0;
  const formats: CompressionFormat[] =
    looksGzip ? ["gzip", "deflate-raw", "deflate"] : looksZlib ? ["deflate", "deflate-raw", "gzip"] : ["deflate-raw", "deflate", "gzip"];
  for (const format of formats) {
    try {
      return await pipe(bytes, new DecompressionStream(format));
    } catch (err) {
      if (err instanceof ProjectFileError) throw err;
    }
  }
  throw new ProjectFileError(DAMAGED);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  // In slices: spreading a long array into one call would overflow the stack.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Takes base64url or plain base64, padded or not, and ignores line breaks from wrapped text.
function base64ToBytes(text: string): Uint8Array {
  const base64 = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  let binary: string;
  try {
    binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  } catch {
    throw new ProjectFileError(DAMAGED);
  }
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

// Percent-decoding that leaves a stray "%" (a note saying "50%") as it is rather than failing.
function percentDecode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/%(?![0-9a-f]{2})/gi, "%25"));
  } catch {
    throw new ProjectFileError(DAMAGED);
  }
}
