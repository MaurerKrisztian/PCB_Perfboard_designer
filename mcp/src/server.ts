import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {INSTRUCTIONS} from "./guide";
import {registerCatalogTools} from "./tools/catalog-tools";
import {registerProjectTools} from "./tools/project-tools";
import {registerBoardTools} from "./tools/board-tools";
import {registerShareLinkTools} from "./tools/share-link-tools";
import {registerResources} from "./resources";

// The Perfboard Designer MCP server: lets an AI agent design a perfboard or stripboard layout as a
// project file and hand the user a share link that opens it in the editor. Projects being worked on
// are kept in memory under an id (project-handles.ts), so an agent sends a file at most once and
// changes it with edit_project; every tool still takes the whole file instead. Runs over stdio.
//
// Built on the editor's own code, reached only through editor.ts; the editor never imports this.

const server = new McpServer({name: "perfboard-designer", version: SERVER_VERSION}, {instructions: INSTRUCTIONS});

registerCatalogTools(server);
registerProjectTools(server);
registerBoardTools(server);
registerShareLinkTools(server);
registerResources(server);

await server.connect(new StdioServerTransport());
