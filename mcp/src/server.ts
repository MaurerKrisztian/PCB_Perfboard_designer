import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {ProjectFileError, readProjectFile} from "../../src/project-file/read-project-file";
import {
  decodeEmbeddedProject, makeShareFragment, MAX_SHARED_PROJECT_BYTES, readShareFragment,
} from "../../src/project-file/share-link";
import {CATALOG, exampleEntry, findPart, placementNotes, searchParts, similarPartIds, summarize} from "./parts";
import {partPins} from "./pins";
import {validateProject} from "./validate";

// The Perfboard Designer MCP server: lets an AI agent design a perfboard or stripboard layout as a
// project file and hand the user a share link that opens it in the editor. Stateless: every tool
// takes the whole project and nothing is kept between calls. Runs over stdio.

const DEFAULT_EDITOR_URL = "https://perfboarddesigner.com/app/";

const INSTRUCTIONS = `Perfboard Designer (https://perfboarddesigner.com) is a browser editor for perfboard and stripboard layouts. With these tools you design a board as a project file (JSON, format version 3) and give the user a link that opens it in the editor, where they can see and change it.

Workflow:
1. list_parts and get_part: pick parts, and learn each one's pins and project file entry.
2. Write the project. Positions are [column, row] holes counted from the top-left hole, both from 0. Neighbouring holes are 2.54 mm (0.1") apart.
3. get_pin_positions: see exactly which hole every pin lands in, then route wires between pins. A wire connects the holes at its two ends. On a stripboard, every hole along a strip is already connected: cut strips (board.cuts) to separate them.
4. validate_project: fix every error. Warnings are likely mistakes, such as two pins of one part shorted by a strip.
5. make_share_link: give the user the link it returns.

To change a board the user shares with you, read it with read_share_link first. The format is documented in the resource perfboard://docs/project-file, links in perfboard://docs/share-links.`;

const json = (value: unknown) => JSON.stringify(value, null, 2);
const reply = (value: unknown) => ({content: [{type: "text" as const, text: json(value)}]});
const failure = (message: string, details?: unknown) =>
  ({content: [{type: "text" as const, text: details === undefined ? message : `${message}\n${json(details)}`}], isError: true});

const projectInput = z.union([z.record(z.string(), z.unknown()), z.string()])
  .describe("The project file: a version 3 project object, or its JSON text. See the perfboard://docs/project-file resource.");

function parseProject(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new ProjectFileError(`\`project\` is text but not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

const boardSummary = (board: {type: string; cols: number; rows: number}) => `${board.cols}×${board.rows} ${board.type}`;

const server = new McpServer({name: "perfboard-designer", version: SERVER_VERSION}, {instructions: INSTRUCTIONS});

server.registerTool("list_parts", {
  title: "List parts",
  description: "Lists the parts a project can place, optionally filtered by words in their id, name, category or keywords (all words must match). Each part's `id` is its definitionId in the project file; use get_part for its pins and how to place it.",
  inputSchema: {
    query: z.string().optional().describe('Words to match, e.g. "capacitor", "555", "header", "relay".'),
    kind: z.enum(["standard-component", "advanced-component", "ic"]).optional()
      .describe("standard-component: two-lead parts placed between two holes. advanced-component: fixed-footprint parts. ic: dual-row chips and modules."),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({query, kind}) => {
  const parts = searchParts(query, kind);
  return reply({count: parts.length, parts: parts.map(summarize)});
});

server.registerTool("get_part", {
  title: "Get part",
  description: "Everything needed to place one part: which project file list it goes in, its pins (offsets from pin 1 at rotation 0) and pin labels, polarity, value unit, holes its body covers, and an example entry to copy.",
  inputSchema: {
    id: z.string().describe('The part\'s id from list_parts, e.g. "resistor", "ne555", "header-pins".'),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({id}) => {
  const part = findPart(id);
  if (!part) {
    const hints = similarPartIds(id);
    return failure(`There's no part "${id}".${hints.length ? ` Did you mean ${hints.map(h => `"${h}"`).join(", ")}?` : ""} Use list_parts to find one.`);
  }
  return reply({...part, howToPlace: placementNotes(part), example: exampleEntry(part)});
});

server.registerTool("validate_project", {
  title: "Validate project",
  description: "Checks a project file and lists every problem with where it is: entries the editor would leave out, unknown parts, pins off the board, two things in one hole, overlapping parts, wires that connect nothing, and on a stripboard, pins shorted by a strip or sitting in a cut hole. Fix all errors before making a link.",
  inputSchema: {project: projectInput},
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project}) => {
  let raw: unknown;
  try {
    raw = parseProject(project);
  } catch (err) {
    return failure((err as Error).message);
  }
  const {ok, project: read, problems} = validateProject(raw);
  return reply({
    ok,
    ...(read ? {
      board: boardSummary(read.board),
      parts: read.placedIcs.length + read.placedStandardComponents.length + read.placedAdvancedComponents.length,
      wires: read.wires.length,
    } : {}),
    problems,
  });
});

server.registerTool("get_pin_positions", {
  title: "Get pin positions",
  description: "Where every placed part's pins land, as [column, row] holes, with pin numbers and labels (e.g. U1 pin 8 VCC), after rotation, plus holes a part's body covers. Use it to route wires to the right holes. The project file doesn't store these: they follow from each part's anchor, rotation and footprint.",
  inputSchema: {
    project: projectInput,
    refs: z.array(z.string()).optional().describe('Only these parts, e.g. ["U1", "R2"]. All parts when omitted.'),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project, refs}) => {
  let read;
  try {
    read = readProjectFile(parseProject(project)).project;
  } catch (err) {
    return failure(err instanceof ProjectFileError ? err.message : String(err));
  }
  const wanted = refs?.map(ref => ref.toUpperCase());
  const parts = partPins(read)
    .filter(part => !wanted || wanted.includes(part.ref.toUpperCase()))
    .map(({ref, kind, part, known, pins, coveredHoles}) => ({
      ref, kind, part, ...(known ? {} : {unknownPart: true}), pins, ...(coveredHoles.length ? {coveredHoles} : {}),
    }));
  return reply({board: boardSummary(read.board), parts});
});

server.registerTool("make_share_link", {
  title: "Make share link",
  description: "Turns a project into a link that opens it in Perfboard Designer: the project travels inside the link, nothing is uploaded. Give the link to the user. The project is validated first; a project with errors gets the list of problems instead of a link, unless allowErrors is set.",
  inputSchema: {
    project: projectInput,
    name: z.string().optional().describe("The project's name in the editor, e.g. \"555 LED blinker\"."),
    allowErrors: z.boolean().optional().describe("Make the link even if validation finds errors."),
    editorUrl: z.string().optional().describe(`The editor's address. Defaults to ${DEFAULT_EDITOR_URL}; use e.g. http://localhost:3000/app/ for a local copy.`),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project, name, allowErrors, editorUrl}) => {
  let raw: unknown;
  try {
    raw = parseProject(project);
  } catch (err) {
    return failure((err as Error).message);
  }
  const {ok, project: read, problems} = validateProject(raw);
  if (!read || (!ok && !allowErrors)) {
    return failure("The project has errors, so no link was made. Fix them (or set allowErrors).", problems);
  }
  let base: URL;
  try {
    base = new URL(editorUrl ?? DEFAULT_EDITOR_URL);
    if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error();
  } catch {
    return failure(`editorUrl "${editorUrl}" isn't an http(s) address.`);
  }
  base.hash = "";
  const link = `${base.href}#${await makeShareFragment(read, name)}`;
  return reply({link, characters: link.length, ...(problems.length ? {problems} : {})});
});

server.registerTool("read_share_link", {
  title: "Read share link",
  description: "Reads the project out of a Perfboard Designer share link (any of its forms: z=, json= or src=, which is downloaded), so you can look at or change a board the user shared. Returns the project as a version 3 project file.",
  inputSchema: {
    link: z.string().describe("The whole link, or just the part after #."),
  },
  annotations: {readOnlyHint: true, openWorldHint: true},
}, async ({link}) => {
  const fragment = link.includes("#") ? link.slice(link.indexOf("#")) : link;
  const share = readShareFragment(fragment.trim());
  if (!share) return failure("That isn't a share link: it has no z=, json= or src= after the #.");
  try {
    let raw: unknown;
    if (share.kind === "embedded") {
      raw = await decodeEmbeddedProject(share);
    } else {
      const response = await fetch(share.url);
      if (!response.ok) return failure(`${share.url} answered with error ${response.status}.`);
      const text = await response.text();
      if (text.length > MAX_SHARED_PROJECT_BYTES) return failure("The linked project is too big.");
      raw = JSON.parse(text);
    }
    const {project, skipped} = readProjectFile(raw);
    return reply({...(share.name ? {name: share.name} : {}), ...(skipped ? {skipped} : {}), project});
  } catch (err) {
    return failure(err instanceof ProjectFileError ? err.message : `It couldn't be read: ${err instanceof Error ? err.message : String(err)}`);
  }
});

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

await server.connect(new StdioServerTransport());
