import {readFile} from "node:fs/promises";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {createServer} from "./create-server";
import {setResvgWasm} from "./board-png";
import {PUBLIC_IMAGE_URL} from "./board-image";
import {STORED_PROJECTS_URL} from "./editor";
import {httpProjectStorage, projectsBaseUrl} from "./stored-projects";

// The Perfboard Designer MCP server: lets an AI agent design a perfboard or stripboard layout as a
// project file and hand the user a share link that opens it in the editor. Projects being worked on
// are kept in memory under an id (project-handles.ts), so an agent sends a file at most once and
// changes it with edit_project; every tool still takes the whole file instead. Runs over stdio;
// worker.ts is the same server hosted on Cloudflare.
//
// Built on the editor's own code, reached only through editor.ts; the editor never imports this.

// build.mjs puts resvg's WebAssembly next to this file.
setResvgWasm(() => readFile(new URL("./resvg.wasm", import.meta.url)));

// The hosted extras, each the public one unless its setting names another or is "off": pictures of
// boards for make_share_link's `image` (PERFBOARD_IMAGE_URL), and stored projects, contacted only
// when an agent asks (PERFBOARD_PROJECTS_URL). Everything else works without them.
const hosted = (setting: string | undefined, publicUrl: string) => (setting?.trim() === "off" ? undefined : setting?.trim() || publicUrl);
const imageUrl = hosted(process.env.PERFBOARD_IMAGE_URL, PUBLIC_IMAGE_URL);
const projectsUrl = hosted(process.env.PERFBOARD_PROJECTS_URL, STORED_PROJECTS_URL);

await createServer({
  editorUrl: process.env.PERFBOARD_EDITOR_URL,
  imageUrl,
  storage: projectsUrl ? httpProjectStorage(projectsBaseUrl(projectsUrl)) : undefined,
}).connect(new StdioServerTransport());
