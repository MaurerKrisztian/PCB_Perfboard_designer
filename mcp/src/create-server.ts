import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {INSTRUCTIONS} from "./guide";
import {registerCatalogTools} from "./tools/catalog-tools";
import {registerProjectTools} from "./tools/project-tools";
import {registerBoardTools} from "./tools/board-tools";
import {PUBLIC_EDITOR_URL, registerShareLinkTools} from "./tools/share-link-tools";
import {registerResources} from "./resources";
import {PUBLIC_IMAGE_URL} from "./board-image";

// The Perfboard Designer MCP server with all its tools and resources, for either transport:
// server.ts (stdio) or worker.ts (Streamable HTTP on Cloudflare). editorUrl is
// PERFBOARD_EDITOR_URL, where share links open; imageUrl serves pictures of boards (board-image.ts),
// the hosted server's own unless given.
export function createServer({editorUrl, imageUrl}: {editorUrl?: string; imageUrl?: string} = {}): McpServer {
  const server = new McpServer({name: "perfboard-designer", version: SERVER_VERSION}, {instructions: INSTRUCTIONS});
  registerCatalogTools(server);
  registerProjectTools(server);
  registerBoardTools(server);
  registerShareLinkTools(server, editorUrl?.trim() || PUBLIC_EDITOR_URL, imageUrl ?? PUBLIC_IMAGE_URL);
  registerResources(server);
  return server;
}
