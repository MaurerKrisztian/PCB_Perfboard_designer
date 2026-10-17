import {
  makeHostedShareFragment, makeStoredShareFragment, ProjectFile, readProjectFile, STORED_ID, STORED_PROJECTS_URL,
} from "./editor";

// Stored projects: a project saved on the hosted server under a short id ("led-blinker"), so a link
// can point at it instead of carrying the whole file. Optional: the self-contained link (z=), which
// needs no server, is always made too, so a board stays shareable if the server is gone. A stored
// project never changes (storing again makes a new id) and is deleted after a year unopened. The
// Worker keeps each in a Durable Object (worker.ts) and serves it at <base>/<id>.json, .png and
// .svg (project-requests.ts), the project storage the editor's short (p=) links and its Share
// dialog use (share-link.ts, STORED_PROJECTS_URL); the stdio server stores through that over HTTP.

// A stored project file is at most this big, as JSON: real boards are a few kB, a big busy one
// well under 100 kB.
export const MAX_STORED_BYTES = 1_000_000;

const MAX_ID_LENGTH = 40;
// The server's own addresses, so an id never shadows one.
const RESERVED_IDS = new Set(["about", "admin", "api", "index", "mcp", "new", "projects", "render"]);

export interface StoredProject {
  id: string;
  project: ProjectFile;
  name?: string;
  // The project file's SHA-256, hex: the same board stored twice under one id keeps it.
  hash: string;
  storedAt: number;
}

// Where stored projects are kept: a Durable Object each on the Worker, or the hosted server's HTTP
// API for the stdio server.
export interface ProjectStorage {
  // Where they're served: <base>/<id>.json, .png and .svg.
  base: string;
  // Stores `project` under the wanted id or name (cleaned up), or the first free variant of it,
  // and resolves to the id it got.
  save(project: ProjectFile, wanted: {id?: string; name?: string}): Promise<string>;
  load(id: string): Promise<ProjectFile | undefined>;
}

// What a stored project's holder answers when asked to keep a board: it did, it already holds this
// very board, or it holds another one.
export type PutResult = "stored" | "same" | "taken";

// The configured address for stored projects (PERFBOARD_PROJECTS_URL), else the public one.
export const projectsBaseUrl = (configured?: string) => (configured?.trim() || STORED_PROJECTS_URL).replace(/\/+$/, "");

// An id from a name: lowercase, accents dropped, every run of anything but letters and digits made a dash.
export function idFromName(name: string): string {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").slice(0, MAX_ID_LENGTH).replace(/^-+|-+$/g, "");
}

// The ids to try for a board, in order: the wanted one, then with more and more of its hash added.
// With nothing wanted, the hash alone.
function candidateIds(wanted: string, hash: string): string[] {
  if (!wanted) return [hash.slice(0, 10), hash.slice(0, 20), hash];
  const plain = wanted.length >= 3 && !RESERVED_IDS.has(wanted) ? [wanted] : [];
  return [...plain, `${wanted}-${hash.slice(0, 6)}`, `${wanted}-${hash.slice(0, 12)}`, `${wanted}-${hash}`];
}

async function projectHash(project: ProjectFile): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(project)));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

// Stores `project` under the first candidate id that's free or already holds this very board.
// `put` asks that id's holder, which decides alone, so two boards stored at once can't both get it.
export async function storeUnderFreeId(
  project: ProjectFile, wanted: {id?: string; name?: string}, put: (entry: StoredProject) => Promise<PutResult>,
): Promise<string> {
  const hash = await projectHash(project);
  const name = wanted.name?.trim() || undefined;
  for (const id of candidateIds(idFromName(wanted.id ?? name ?? ""), hash)) {
    if (await put({id, project, ...(name ? {name} : {}), hash, storedAt: Date.now()}) !== "taken") return id;
  }
  throw new Error("No free id was left for it.");
}

// The id of a stored project an address points at, if it's one of `base`'s project files.
export function storedIdAt(base: string, url: string): string | undefined {
  if (!url.startsWith(`${base}/`)) return undefined;
  const id = /^([a-z0-9-]+)\.json$/i.exec(url.slice(base.length + 1))?.[1].toLowerCase();
  return id && STORED_ID.test(id) ? id : undefined;
}

// Everything a stored project is reached by: a short link that opens it in the editor at
// `editorBase`, its file, and its pictures. The link is a p= link when the project is in the public
// storage, which editors read p= links from; stored anywhere else, a src= link to its file.
export function storedAddresses(base: string, id: string, editorBase: string, name?: string) {
  const file = `${base}/${id}.json`;
  const fragment = base === STORED_PROJECTS_URL ? makeStoredShareFragment(id, name) : makeHostedShareFragment(file, name);
  return {id, link: `${editorBase}#${fragment}`, file, image: `${base}/${id}.svg`, png: `${base}/${id}.png`};
}

// Stores through the hosted server's HTTP API (project-requests.ts), as the stdio server does, so a
// board stored from anyone's computer is served from the same place.
export function httpProjectStorage(base: string): ProjectStorage {
  return {
    base,
    async save(project, wanted) {
      const response = await fetch(`${base}/projects`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({project, ...wanted}),
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${base} answered with error ${response.status}: ${text.trim()}`);
      return (JSON.parse(text) as {id: string}).id;
    },
    async load(id) {
      if (!STORED_ID.test(id)) return undefined;
      const response = await fetch(`${base}/${id}.json`);
      if (response.status === 404) return undefined;
      if (!response.ok) throw new Error(`${base} answered with error ${response.status}.`);
      return readProjectFile(await response.json()).project;
    },
  };
}
