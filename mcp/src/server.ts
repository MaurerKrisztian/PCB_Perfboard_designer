import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {ProjectFileError, readProjectFile} from "../../src/project-file/read-project-file";
import {
  decodeEmbeddedProject, makeShareFragment, MAX_SHARED_PROJECT_BYTES, readShareFragment,
} from "../../src/project-file/share-link";
import {CATALOG, exampleEntry, findPart, placementNotes, searchParts, similarPartIds, summarize} from "./parts";
import {partPins} from "../../src/project-file/pin-positions";
import {computeNets} from "../../src/project-file/nets";
import {layoutProjectWires} from "../../src/project-file/wire-crossings";
import {validateProject} from "./validate";
import {netsReport} from "./nets-report";

// The Perfboard Designer MCP server: lets an AI agent design a perfboard or stripboard layout as a
// project file and hand the user a share link that opens it in the editor. Stateless: every tool
// takes the whole project and nothing is kept between calls. Runs over stdio.

const DEFAULT_EDITOR_URL = "https://perfboarddesigner.com/app/";

const INSTRUCTIONS = `Perfboard Designer (https://perfboarddesigner.com) is a browser editor for perfboard and stripboard layouts. With these tools you design a board as a project file (JSON, format version 3) and give the user a link that opens it in the editor, where they can see and change it.

Workflow:
1. list_parts and get_part: pick parts, and learn each one's pins and project file entry.
2. Write the project. Positions are [column, row] holes counted from the top-left hole, both from 0. Neighbouring holes are 2.54 mm (0.1") apart.
3. get_pin_positions: see exactly which hole every pin lands in, then route wires between pins. Wires are insulated jumpers: a wire joins only the holes at its two ends, never a hole it passes over, and wires may cross each other (that's fine, not a short). Things in the same hole are joined. On a stripboard, every hole along a strip is already connected: cut strips (board.cuts) to separate them.
4. get_nets: check the circuit is the one you meant: which pins each net joins (named like "U1.8 VCC", "D1.K", "R1.1"), pins connected to nothing, and where wires cross.
5. validate_project: fix every error. Warnings are likely mistakes, such as two pins of one part shorted by a strip, a wire passing over a pin without joining it, or two supply rails shorted. Pass expectNets (your netlist, e.g. [["U1.8", "U1.4", "R1.1", "J1.1"], ...]) to have every missing or extra connection reported as an error.
6. make_share_link: give the user the link it returns.

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
  description: "Checks a project file and lists every problem with where it is: entries the editor would leave out, unknown parts, pins off the board, two things in one hole, overlapping parts, wires that connect nothing, a wire passing over a pin or lead without ending there (so not joined to it), IC pins connected to nothing, supply rails shorted together, and on a stripboard, pins shorted by a strip or sitting in a cut hole. With expectNets, every connection missing from the board or extra on it is an error. Wires crossing each other are fine (insulated jumpers) and only listed in notes. Fix all errors before making a link.",
  inputSchema: {
    project: projectInput,
    expectNets: z.array(z.array(z.string())).optional().describe('The nets the board should make: each a list of pins written REF.pin, e.g. [["U1.8", "U1.4", "R1.1", "J1.1"], ["U1.2", "U1.6", "C1.+"]]. A pin can also be named by its label ("U1.VCC", "D1.K") or as get_nets writes it ("U1.8 VCC"). List every net of two or more pins: a pin in none of them should connect to nothing.'),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project, expectNets}) => {
  let raw: unknown;
  try {
    raw = parseProject(project);
  } catch (err) {
    return failure((err as Error).message);
  }
  const {ok, project: read, problems, notes} = validateProject(raw, expectNets);
  return reply({
    ok,
    ...(read ? {
      board: boardSummary(read.board),
      parts: read.placedIcs.length + read.placedStandardComponents.length + read.placedAdvancedComponents.length,
      wires: read.wires.length,
    } : {}),
    problems,
    ...(notes.length ? {notes} : {}),
  });
});

server.registerTool("get_nets", {
  title: "Get nets",
  description: "Which pins the board connects: every net with its name (from its pins, e.g. GND), its pins (\"U1.8 VCC\" for a chip's pin, \"D1.K\" or \"C1.+\" for a polarized lead, \"R1.1\" otherwise) and the wires on it (indexes into wires). Also pins connected to nothing, wires that connect no pins, junctions (holes where three or more things are joined) and crossings (where a wire goes over another wire or over a hole without joining it). Wires are insulated jumpers: a wire joins only the holes at its two ends, so crossings are information, not connections or shorts. On a stripboard the strips connect too.",
  inputSchema: {project: projectInput},
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project}) => {
  let raw: unknown;
  try {
    raw = parseProject(project);
  } catch (err) {
    return failure((err as Error).message);
  }
  const {project: read, wireIndex, problems} = validateProject(raw);
  if (!read) return failure("The project couldn't be read.", problems);
  const errors = problems.filter(p => p.severity === "error").length;
  return reply({
    board: boardSummary(read.board),
    ...(errors ? {errors: `validate_project finds ${errors} error${errors === 1 ? "" : "s"}: these are the nets of the board as the editor would read it.`} : {}),
    ...netsReport(read, computeNets(read), layoutProjectWires(read), wireIndex),
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
