import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {createServer} from "./create-server";

// The Perfboard Designer MCP server: lets an AI agent design a perfboard or stripboard layout as a
// project file and hand the user a share link that opens it in the editor. Projects being worked on
// are kept in memory under an id (project-handles.ts), so an agent sends a file at most once and
// changes it with edit_project; every tool still takes the whole file instead. Runs over stdio;
// worker.ts is the same server hosted on Cloudflare.
//
// Built on the editor's own code, reached only through editor.ts; the editor never imports this.

await createServer({editorUrl: process.env.PERFBOARD_EDITOR_URL}).connect(new StdioServerTransport());
