import {DurableObject, DurableObjectNamespace} from "cloudflare:workers";
import {WebStandardStreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {createServer} from "./create-server";
import {ProjectFile, STORED_ID} from "./editor";
import {handleImageRequest} from "./image-requests";
import {handleStoredProjectRequest, handleStoreRequest, isStoredProjectPath} from "./project-requests";
import {setResvgWasm} from "./board-png";
import {HeldProject, ProjectStore, setProjectStore} from "./project-handles";
import {
  ProjectStorage, projectsBaseUrl, PutResult, StoredProject, storeUnderFreeId,
} from "./stored-projects";
import {PUBLIC_EDITOR_URL} from "./tools/share-link-tools";
// Uploaded with the Worker: build.mjs copies it next to worker.js.
import resvgWasm from "./resvg.wasm";

// The same MCP server as server.ts, hosted on Cloudflare Workers over Streamable HTTP at /mcp.
// Stateless: every request gets a fresh server, so the projects agents work on can't live in
// memory. Each is kept in its own Durable Object (ProjectHolder), named by its projectId, which
// reads back exactly what was last written, and forgets it after KEEP_FOR_MS unused. Stored
// projects (stored-projects.ts) are Durable Objects too (StoredProjectHolder), named by their id,
// and served over HTTP beside /mcp.

interface Env {
  PROJECTS: DurableObjectNamespace<ProjectHolder>;
  STORED_PROJECTS: DurableObjectNamespace<StoredProjectHolder>;
  // Where share links open; the public editor when unset (wrangler.toml's [vars]).
  PERFBOARD_EDITOR_URL?: string;
  // Where stored projects are served; https://projects.perfboarddesigner.com when unset.
  PERFBOARD_PROJECTS_URL?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_FOR_MS = 30 * DAY_MS;
const KEEP_STORED_FOR_MS = 365 * DAY_MS;

setResvgWasm(async () => resvgWasm);

// The ids project-handles.ts makes: anything else is no project, without waking an object.
const PROJECT_ID = /^p-[0-9a-z]{10}$/;

export class ProjectHolder extends DurableObject<Env> {
  async load(): Promise<HeldProject | undefined> {
    const entry = await this.ctx.storage.get<HeldProject>("entry");
    if (entry) await this.keep();
    return entry;
  }

  async save(entry: HeldProject): Promise<void> {
    await this.ctx.storage.put("entry", entry);
    await this.keep();
  }

  // Pushes back the day it's forgotten.
  private keep(): Promise<void> {
    return this.ctx.storage.setAlarm(Date.now() + KEEP_FOR_MS);
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

function durableProjectStore(env: Env): ProjectStore {
  const holder = (id: string) => env.PROJECTS.get(env.PROJECTS.idFromName(id));
  return {
    get: async id => (PROJECT_ID.test(id) ? holder(id).load() : undefined),
    put: entry => holder(entry.id).save(entry),
    lifetime: "Ids are forgotten after 30 days unused",
  };
}

// One stored project, named by its id. It never changes once stored, and is deleted after
// KEEP_STORED_FOR_MS unopened.
export class StoredProjectHolder extends DurableObject<Env> {
  async put(entry: StoredProject): Promise<PutResult> {
    const held = await this.ctx.storage.get<StoredProject>("entry");
    if (held && held.hash !== entry.hash) return "taken";
    if (!held) await this.ctx.storage.put("entry", entry);
    await this.keep();
    return held ? "same" : "stored";
  }

  async load(): Promise<ProjectFile | undefined> {
    const entry = await this.ctx.storage.get<StoredProject>("entry");
    if (entry) await this.keep();
    return entry?.project;
  }

  // Pushes back the day it's deleted; at most once a day, as every opening and picture comes here.
  private async keep(): Promise<void> {
    const due = await this.ctx.storage.getAlarm();
    if (due === null || due < Date.now() + KEEP_STORED_FOR_MS - DAY_MS) await this.ctx.storage.setAlarm(Date.now() + KEEP_STORED_FOR_MS);
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }
}

function durableProjectStorage(env: Env): ProjectStorage {
  const holder = (id: string) => env.STORED_PROJECTS.get(env.STORED_PROJECTS.idFromName(id));
  return {
    base: projectsBaseUrl(env.PERFBOARD_PROJECTS_URL),
    save: (project, wanted) => storeUnderFreeId(project, wanted, entry => holder(entry.id).put(entry)),
    // Anything that isn't an id is no project, without waking an object.
    load: async id => (STORED_ID.test(id) ? holder(id).load() : undefined),
  };
}

// Any web page may call it: there's no account or cookie to protect.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}

const ABOUT = `Perfboard Designer MCP server (https://perfboarddesigner.com).

Add it to an MCP client as a Streamable HTTP server at <this address>/mcp, e.g.
  claude mcp add --transport http perfboard <this address>/mcp

A picture of a board: <this address>/render.svg?<a share link's part after the #>
(or /render.png?… for a PNG)

Store a project: POST <this address>/projects with {"project": {…}, "id": "my-board"}
A stored project: <this address>/<id>.json, its pictures <id>.png and <id>.svg
`;

const editorBase = (env: Env) => env.PERFBOARD_EDITOR_URL?.trim() || PUBLIC_EDITOR_URL;

// Pictures and stored projects' files are the same every time for one address, so each Cloudflare
// data center keeps a copy (the Cache API) for as long as their Cache-Control allows, and answers
// with it: drawing a PNG takes far more CPU than finding one. Only GETs that worked are kept, so an
// unknown id is looked up again next time. After a change to how boards are drawn, old pictures stay
// until they expire or the zone's cache is purged.
async function edgeCached(request: Request, ctx: ExecutionContext, respond: () => Promise<Response>): Promise<Response> {
  if (request.method !== "GET") return respond();
  const cache = caches.default;
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const response = await respond();
  if (response.ok) ctx.waitUntil(cache.put(request.url, response.clone()));
  return response;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const {pathname, origin} = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS_HEADERS});
    if (pathname === "/") return withCors(new Response(ABOUT.replaceAll("<this address>", origin), {headers: {"Content-Type": "text/plain; charset=utf-8"}}));
    if (pathname === "/render.svg") return withCors(await edgeCached(request, ctx, () => handleImageRequest(request, "svg")));
    if (pathname === "/render.png") return withCors(await edgeCached(request, ctx, () => handleImageRequest(request, "png")));
    if (pathname === "/projects") return withCors(await handleStoreRequest(request, durableProjectStorage(env), editorBase(env)));
    if (isStoredProjectPath(pathname)) {
      return withCors(await edgeCached(request, ctx, () => handleStoredProjectRequest(request, durableProjectStorage(env))));
    }
    if (pathname !== "/mcp") return withCors(new Response("Not found: the MCP server is at /mcp.\n", {status: 404}));
    // Stateless, so no stream for server-sent messages to open and no session to end.
    if (request.method !== "POST") {
      return withCors(new Response("Method not allowed: POST JSON-RPC messages to /mcp.\n", {status: 405, headers: {Allow: "POST, OPTIONS"}}));
    }

    setProjectStore(durableProjectStore(env));
    const server = createServer({editorUrl: env.PERFBOARD_EDITOR_URL, imageUrl: `${origin}/render.svg`, storage: durableProjectStorage(env)});
    const transport = new WebStandardStreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true});
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  },
};
