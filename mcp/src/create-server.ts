import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {INSTRUCTIONS} from "./guide";
import {registerCatalogTools} from "./tools/catalog-tools";
import {registerProjectTools} from "./tools/project-tools";
import {registerBoardTools} from "./tools/board-tools";
import {PUBLIC_EDITOR_URL, registerShareLinkTools} from "./tools/share-link-tools";
import {registerResources} from "./resources";
import {ProjectStorage} from "./stored-projects";

// The Perfboard Designer MCP server with all its tools and resources, for either transport:
// server.ts (stdio) or worker.ts (Streamable HTTP on Cloudflare). editorUrl is
// PERFBOARD_EDITOR_URL, where share links open. The hosted extras, which it works without: imageUrl
// serves pictures of boards (board-image.ts), storage keeps stored projects (stored-projects.ts).
export function createServer({editorUrl, imageUrl, storage}: {editorUrl?: string; imageUrl?: string; storage?: ProjectStorage}): McpServer {
  const server = new McpServer({name: "perfboard-designer", version: SERVER_VERSION}, {instructions: INSTRUCTIONS});
  registerCatalogTools(server);
  registerProjectTools(server);
  registerBoardTools(server);
  registerShareLinkTools(server, editorUrl?.trim() || PUBLIC_EDITOR_URL, imageUrl, storage);
  registerResources(server);
  return server;
}
