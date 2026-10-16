import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {CATALOG} from "./parts";
import {EXAMPLES, exampleProject} from "./examples";
import {GUIDE} from "./guide";
import {json} from "./reply";

// The documents an agent can read: the guide, the formats, the parts catalog and the examples.

export function registerResources(server: McpServer) {
  server.registerResource("guide", "perfboard://docs/guide", {
    title: "Guide",
    description: "How to design a board with these tools, step by step, and the rules: what can share a hole, how wires and strips connect.",
    mimeType: "text/markdown",
  }, async uri => ({contents: [{uri: uri.href, mimeType: "text/markdown", text: GUIDE}]}));

  server.registerResource("project-file-format", "perfboard://docs/project-file", {
    title: "Project file format",
    description: "The project file format (version 3), field by field, as the TypeScript types that define it.",
    mimeType: "text/plain",
  }, async uri => ({contents: [{uri: uri.href, mimeType: "text/plain", text: PROJECT_FILE_SOURCE}]}));

  server.registerResource("share-links", "perfboard://docs/share-links", {
    title: "Share links",
    description: "How a share link carries a project, and what happens when the user opens one.",
    mimeType: "text/markdown",
  }, async uri => ({contents: [{uri: uri.href, mimeType: "text/markdown", text: SHARE_LINKS_DOC}]}));

  server.registerResource("parts", "perfboard://parts", {
    title: "Parts catalog",
    description: "Every part a project can place, with pins and pin labels, as JSON.",
    mimeType: "application/json",
  }, async uri => ({contents: [{uri: uri.href, mimeType: "application/json", text: json(CATALOG)}]}));

  for (const [id, {title, description}] of Object.entries(EXAMPLES)) {
    server.registerResource(`example-${id}`, `perfboard://examples/${id}`, {
      title, description: `${description} new_project with example "${id}" starts a project from it.`, mimeType: "application/json",
    }, async uri => ({contents: [{uri: uri.href, mimeType: "application/json", text: json(exampleProject(id))}]}));
  }
}
