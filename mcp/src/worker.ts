import {DurableObject, DurableObjectNamespace} from "cloudflare:workers";
import {WebStandardStreamableHTTPServerTransport} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {createServer} from "./create-server";
import {handleImageRequest} from "./board-image";
import {HeldProject, ProjectStore, setProjectStore} from "./project-handles";

// The same MCP server as server.ts, hosted on Cloudflare Workers over Streamable HTTP at /mcp.
// Stateless: every request gets a fresh server, so the projects agents work on can't live in
// memory. Each is kept in its own Durable Object (ProjectHolder), named by its projectId, which
// reads back exactly what was last written, and forgets it after KEEP_FOR_MS unused.

interface Env {
  PROJECTS: DurableObjectNamespace<ProjectHolder>;
  // Where share links open; the public editor when unset (wrangler.toml's [vars]).
  PERFBOARD_EDITOR_URL?: string;
}

const KEEP_FOR_MS = 30 * 24 * 60 * 60 * 1000;

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
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const {pathname, origin} = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS_HEADERS});
    if (pathname === "/") return withCors(new Response(ABOUT.replaceAll("<this address>", origin), {headers: {"Content-Type": "text/plain; charset=utf-8"}}));
    if (pathname === "/render.svg") return withCors(await handleImageRequest(request));
    if (pathname !== "/mcp") return withCors(new Response("Not found: the MCP server is at /mcp.\n", {status: 404}));
    // Stateless, so no stream for server-sent messages to open and no session to end.
    if (request.method !== "POST") {
      return withCors(new Response("Method not allowed: POST JSON-RPC messages to /mcp.\n", {status: 405, headers: {Allow: "POST, OPTIONS"}}));
    }

    setProjectStore(durableProjectStore(env));
    const server = createServer({editorUrl: env.PERFBOARD_EDITOR_URL, imageUrl: `${origin}/render.svg`});
    const transport = new WebStandardStreamableHTTPServerTransport({sessionIdGenerator: undefined, enableJsonResponse: true});
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  },
};
