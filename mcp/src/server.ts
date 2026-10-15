import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import {ProjectFileError, readProjectFile} from "../../src/project-file/read-project-file";
import {
  decodeEmbeddedProject, makeShareFragment, MAX_SHARED_PROJECT_BYTES, readShareFragment,
} from "../../src/project-file/share-link";
import {
  CATALOG, closestParts, exampleEntry, findPart, partsByCategory, placementNotes, searchParts, similarPartIds, summarize,
} from "./parts";
import {partPins} from "../../src/project-file/pin-positions";
import {computeNets} from "../../src/project-file/nets";
import {layoutProjectWires} from "../../src/project-file/wire-crossings";
import {PROJECT_FILE_VERSION, ProjectFile} from "../../src/project-file/project-file";
import {validateProject} from "./validate";
import {netsReport} from "./nets-report";
import {applyEdits, editOp, isEditError, pinsOf} from "./edit-project";
import {HeldProject, heldProject, holdProject, replaceHeldProject, unknownProjectId} from "./project-handles";

// The Perfboard Designer MCP server: lets an AI agent design a perfboard or stripboard layout as a
// project file and hand the user a share link that opens it in the editor. Projects being worked on
// are kept in memory under an id (project-handles.ts), so an agent sends a file at most once and
// changes it with edit_project; every tool still takes the whole file instead. Runs over stdio.

const PUBLIC_EDITOR_URL = "https://perfboarddesigner.com/app/";

const INSTRUCTIONS = `Perfboard Designer (https://perfboarddesigner.com) is a browser editor for perfboard and stripboard layouts. With these tools you design a board as a project file (JSON, format version 3) and give the user a link that opens it in the editor, where they can see and change it.

Workflow:
1. list_parts with no query: every part, by category, in one call. Then get_part with ids: every part you use, in one call: its pins, polarity and footprint.
2. new_project (cols, rows, type): a blank board, kept here under a projectId. Pass the projectId to every other tool instead of the whole project file. (new_project with example starts from an example project; see the perfboard://examples resources.)
3. edit_project with a list of ops: place parts (add_part with the part's id and "at", or "from" and "to" for a two-lead part) and route wires (add_wire with "from" and "to", or a "path" of holes for a wire with corners). Each reply says where the new parts' pins landed and checks the board; once it has no errors, the reply lists its nets too. Positions are [column, row] holes counted from the top-left hole, both from 0. Neighbouring holes are 2.54 mm (0.1") apart. Wires are insulated jumpers: a wire joins only the holes at its two ends (and a path's corners), never a hole it passes over, and wires may cross each other (that's fine, not a short). Things in the same hole are joined. On a stripboard, every hole along a strip is already connected: cut strips (add_cuts) to separate them.
4. Check the circuit is the one you meant: the nets in edit_project's reply (pins named like "U1.8 VCC", "D1.K", "R1.1"), or get_nets for junctions and crossings too. Give expectNets (your netlist, e.g. [["U1.8", "U1.4", "R1.1", "J1.1"], ...]) once, to edit_project or validate_project, and every missing or extra connection is reported as an error from then on.
5. Fix every error. Warnings are likely mistakes, such as two pins of one part shorted by a strip, a wire passing over a pin without joining it, a lead or wires connected to nothing, or two supply rails shorted. validate_project lists notes too.
6. make_share_link with the projectId: give the user the link it returns.

get_project returns the whole file. Projects are kept only while the server runs; a whole project file works in place of a projectId everywhere. To change a board the user shares with you, read it with read_share_link: it returns a projectId to edit. The format is documented in the resource perfboard://docs/project-file, links in perfboard://docs/share-links.`;

// JSON for replies: indented, but anything short enough (a hole, a wire, a part entry) on one
// line, so a project file reads one entry per line and costs far fewer tokens.
function json(value: unknown, indent = ""): string {
  const flat = JSON.stringify(value) ?? "null";
  if (typeof value !== "object" || value === null || flat.length + indent.length <= 110) return flat;
  const inner = `${indent}  `;
  if (Array.isArray(value)) return `[\n${value.map(item => inner + json(item, inner)).join(",\n")}\n${indent}]`;
  const entries = Object.entries(value).filter(([, item]) => item !== undefined);
  return `{\n${entries.map(([key, item]) => `${inner}${JSON.stringify(key)}: ${json(item, inner)}`).join(",\n")}\n${indent}}`;
}
const reply = (value: unknown) => ({content: [{type: "text" as const, text: json(value)}]});
const failure = (message: string, details?: unknown) =>
  ({content: [{type: "text" as const, text: details === undefined ? message : `${message}\n${json(details)}`}], isError: true});

const projectInput = z.union([z.record(z.string(), z.unknown()), z.string()]).optional()
  .describe("The whole project file: a version 3 project object, or its JSON text (see the perfboard://docs/project-file resource). Give this or projectId.");
const projectIdInput = z.string().optional()
  .describe("The id of a project kept here (from new_project, validate_project, edit_project or read_share_link), instead of sending the whole project.");
const expectNetsInput = z.array(z.array(z.string())).optional().describe('The nets the board should make: each a list of pins written REF.pin, e.g. [["U1.8", "U1.4", "R1.1", "J1.1"], ["U1.2", "U1.6", "C1.+"]]. A pin can also be named by its label ("U1.VCC", "D1.K") or as get_nets writes it ("U1.8 VCC"). List every net of two or more pins: a pin in none of them should connect to nothing. With a projectId it\'s remembered for that project, so later checks use it too; [] forgets it.');

function parseProject(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    throw new ProjectFileError(`\`project\` is text but not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// The project a tool was given: the raw file (`project`) or one kept here (`projectId`).
type Source = {raw: unknown; held?: HeldProject} | {error: string};

function source({project, projectId}: {project?: unknown; projectId?: string}): Source {
  if (project !== undefined && projectId) return {error: "Give either `project` or `projectId`, not both."};
  if (projectId) {
    const held = heldProject(projectId);
    return held ? {raw: held.project, held} : {error: unknownProjectId(projectId)};
  }
  if (project === undefined) return {error: "Give the project: its `projectId`, or the whole file as `project`."};
  try {
    return {raw: parseProject(project)};
  } catch (err) {
    return {error: (err as Error).message};
  }
}

// expectNets for a check: the ones given (remembered for a kept project; [] forgets them), else
// the ones remembered.
function expectedNets(given: string[][] | undefined, held: HeldProject | undefined): string[][] | undefined {
  if (held && given) held.expectNets = given.length ? given : undefined;
  return given?.length ? given : held?.expectNets;
}

const boardSummary = (board: {type: string; cols: number; rows: number}) => `${board.cols}×${board.rows} ${board.type}`;
const partCount = (project: ProjectFile) =>
  project.placedIcs.length + project.placedStandardComponents.length + project.placedAdvancedComponents.length;

// What new_project and edit_project tell the agent after a change: whether the board is valid now
// and what's wrong, and when it's valid, its nets, so it needn't call get_nets to check them.
function checkedProject(held: HeldProject) {
  const {project} = held;
  const {ok, problems, notes} = validateProject(project, held.expectNets);
  const nets = ok ? netsReport(project, computeNets(project), layoutProjectWires(project), i => i) : undefined;
  return {
    projectId: held.id,
    revision: held.revision,
    board: boardSummary(project.board),
    parts: partCount(project),
    wires: project.wires.length,
    ok,
    ...(held.expectNets ? {checkedAgainst: `expectNets (${held.expectNets.length} net${held.expectNets.length === 1 ? "" : "s"})`} : {}),
    problems,
    ...(notes.length ? {notes: `${notes.length} note${notes.length === 1 ? "" : "s"} (wires crossing and the like): validate_project lists them.`} : {}),
    ...(nets
      ? {nets: nets.nets, unconnected: nets.unconnected, ...(nets.strayWires ? {strayWires: nets.strayWires} : {})}
      : {nets: "Left out while the board has errors: fix them, or call get_nets."}),
  };
}

// The editor address links open in: PERFBOARD_EDITOR_URL (set in the MCP client's config) or the
// public site.
const DEFAULT_EDITOR_URL = process.env.PERFBOARD_EDITOR_URL?.trim() || PUBLIC_EDITOR_URL;

// Example projects, baked in by build.mjs, served as resources and as new_project's `example`.
const EXAMPLES: Record<string, {title: string; description: string}> = {
  "555-led-blinker": {
    title: "555 LED blinker (perfboard)",
    description: "An NE555 astable flashing an LED about once a second, on a perfboard: chip, two timing resistors, timing and control capacitors, LED with its resistor, and a power header, all joined by wires.",
  },
  "555-led-blinker-stripboard": {
    title: "555 LED blinker (stripboard)",
    description: "The same 555 LED blinker on a stripboard with horizontal strips: the strips do most of the wiring, with cuts under the chip so its two pin rows aren't shorted, and a few wire links.",
  },
};

function exampleProject(id: string): ProjectFile | undefined {
  const text = EXAMPLE_PROJECTS[id];
  return text === undefined ? undefined : readProjectFile(JSON.parse(text)).project;
}

const server = new McpServer({name: "perfboard-designer", version: SERVER_VERSION}, {instructions: INSTRUCTIONS});

server.registerTool("list_parts", {
  title: "List parts",
  description: "Lists the parts a project can place. Without a query: every part, grouped by category, as its id with its name and pin count; call it this way once to see what there is. With a query: the parts whose id, name, category or keywords contain all its words, or the closest ones when none do. Each part's `id` is its definitionId in the project file; use get_part for its pins and how to place it.",
  inputSchema: {
    query: z.string().optional().describe('Words to match, e.g. "capacitor", "555", "header", "relay". Leave it out to list every part.'),
    kind: z.enum(["standard-component", "advanced-component", "ic"]).optional()
      .describe("standard-component: two-lead parts placed between two holes. advanced-component: fixed-footprint parts. ic: dual-row chips and modules."),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({query, kind}) => {
  if (!query?.trim()) {
    const parts = searchParts(undefined, kind);
    return reply({count: parts.length, byCategory: partsByCategory(parts)});
  }
  const parts = searchParts(query, kind);
  if (parts.length) return reply({count: parts.length, parts: parts.map(summarize)});
  const closest = closestParts(query, kind);
  return reply(closest.length
    ? {count: 0, parts: [], hint: `No part matches every word of "${query}". These match some of them; list_parts with no query lists every part.`, closest: closest.map(summarize)}
    : {count: 0, parts: [], hint: `No part matches "${query}". list_parts with no query lists every part.`});
});

server.registerTool("get_part", {
  title: "Get parts",
  description: "Everything needed to place parts: for each, which project file list it goes in, its pins (offsets from pin 1 at rotation 0) and pin labels, polarity, value unit, holes its body covers, and an example entry. Ask for every part you use in one call with `ids`.",
  inputSchema: {
    ids: z.array(z.string()).optional().describe('Part ids from list_parts, e.g. ["resistor", "ne555", "header-pins"].'),
    id: z.string().optional().describe("One part id, instead of `ids`."),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({ids, id}) => {
  const wanted = [...(ids ?? []), ...(id ? [id] : [])];
  if (!wanted.length) return failure("Give `ids`: the part ids from list_parts.");
  const found = [];
  const missing: string[] = [];
  for (const name of wanted) {
    const part = findPart(name);
    if (!part) {
      const hints = similarPartIds(name);
      missing.push(`There's no part "${name}".${hints.length ? ` Did you mean ${hints.map(h => `"${h}"`).join(", ")}?` : ""}`);
      continue;
    }
    found.push({...part, howToPlace: placementNotes(part), example: exampleEntry(part)});
  }
  if (!found.length) return failure(`${missing.join(" ")} Use list_parts to find one.`);
  // One part asked for the old way: just that part, as before.
  if (id && !ids && found.length === 1) return reply(found[0]);
  return reply({parts: found, ...(missing.length ? {missing} : {})});
});

server.registerTool("new_project", {
  title: "New project",
  description: "Starts a project kept here under a projectId: a blank board, or one of the example projects (perfboard://examples/...) to copy from. Returns the projectId and the project file. Then add parts and wires with edit_project, and pass the projectId to every other tool instead of the whole file.",
  inputSchema: {
    cols: z.number().int().min(1).max(500).optional().describe("Holes across. 30 when left out."),
    rows: z.number().int().min(1).max(500).optional().describe("Holes down. 20 when left out."),
    type: z.enum(["perfboard", "stripboard"]).optional().describe("perfboard (default): a separate pad per hole. stripboard: copper strips joining every hole along each row (or column)."),
    strips: z.enum(["horizontal", "vertical"]).optional().describe("A stripboard's strips: along rows (horizontal, default) or columns."),
    name: z.string().optional().describe("The project's name, used by make_share_link."),
    example: z.enum(Object.keys(EXAMPLES) as [string, ...string[]]).optional().describe(`Start from an example instead of a blank board: ${Object.entries(EXAMPLES).map(([id, e]) => `"${id}" (${e.title})`).join(", ")}.`),
  },
  annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false},
}, async ({cols, rows, type, strips, name, example}) => {
  let project: ProjectFile;
  if (example) {
    if (cols || rows || type || strips) return failure("An example comes with its board: leave out cols, rows, type and strips, and change it with edit_project's set_board.");
    project = exampleProject(example)!;
  } else {
    if (strips && type !== "stripboard") return failure("`strips` is for a stripboard: add type \"stripboard\".");
    const size = {cols: cols ?? 30, rows: rows ?? 20};
    project = {
      version: PROJECT_FILE_VERSION,
      board: type === "stripboard" ? {type, ...size, strips: strips ?? "horizontal", cuts: []} : {type: "perfboard", ...size},
      pads: [], wires: [], placedIcs: [], placedStandardComponents: [], placedAdvancedComponents: [], customIcs: [],
    };
  }
  const held = holdProject(project, {name: name ?? (example ? EXAMPLES[example].title : undefined)});
  return reply({...checkedProject(held), project: held.project});
});

server.registerTool("edit_project", {
  title: "Edit project",
  description: "Changes a project kept here, by a list of ops applied in order: add_part, update_part (move, turn, change value or ref), remove_parts, add_wire (from/to, or a `path` of holes made into one wire per leg), update_wire, remove_wires, set_board, add_cuts / remove_cuts (stripboard), set_pad. If any op can't be done, none are. Returns what changed, where the pins of added or moved parts landed, and the board checked as validate_project does (with any expectNets remembered for it); when it has no errors, also its nets. get_project returns the whole file.",
  inputSchema: {
    projectId: projectIdInput,
    project: projectInput.describe("A whole project file to start from instead of a projectId: it's kept here and the reply gives its new projectId."),
    ops: z.array(editOp).min(1),
    expectNets: expectNetsInput,
  },
  annotations: {readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false},
}, async ({projectId, project, ops, expectNets}) => {
  const from = source({project, projectId});
  if ("error" in from) return failure(from.error);
  let held = from.held;
  if (!held) {
    const {ok, project: read, problems} = validateProject(from.raw);
    if (!read) return failure("The project couldn't be read.", problems);
    if (!ok && problems.some(p => p.message.includes("was left out"))) {
      return failure("Some of the project's entries couldn't be read. Fix them first (validate_project lists them), or edit what's left: pass its projectId from validate_project.", problems);
    }
    held = holdProject(read);
  }
  let result;
  try {
    result = applyEdits(held.project, ops);
  } catch (err) {
    if (isEditError(err)) return failure(err.message);
    throw err;
  }
  // Read back as the editor would: anything the reader leaves out (a part pushed off a shrunk
  // board) would be lost without a word, so it's refused instead.
  let read;
  try {
    read = readProjectFile(result.project);
  } catch (err) {
    return failure(`${err instanceof ProjectFileError ? err.message : String(err)} No change was made.`);
  }
  if (read.skipped) {
    const {problems} = validateProject(result.project);
    return failure("These ops would leave entries the editor can't read, so no change was made:", problems.filter(p => p.message.includes("was left out")));
  }
  replaceHeldProject(held, read.project);
  expectedNets(expectNets, held);
  return reply({
    changes: result.changes,
    ...(result.placed.length ? {pins: pinsOf(held.project, result.placed)} : {}),
    ...checkedProject(held),
  });
});

server.registerTool("get_project", {
  title: "Get project",
  description: "The whole project file of a project kept here, as the editor would save it (version 3), one entry per line.",
  inputSchema: {projectId: z.string()},
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({projectId}) => {
  const held = heldProject(projectId);
  if (!held) return failure(unknownProjectId(projectId));
  return reply({projectId: held.id, revision: held.revision, ...(held.name ? {name: held.name} : {}), project: held.project});
});

server.registerTool("validate_project", {
  title: "Validate project",
  description: "Checks a project file and lists every problem with where it is: entries the editor would leave out, unknown parts, pins off the board, two things in one hole, overlapping parts, wires that connect nothing (a loose end, or no pins on their net), a wire passing over a pin or lead without ending there (so not joined to it), IC pins and two-lead parts' leads connected to nothing, supply rails shorted together, and on a stripboard, pins shorted by a strip or sitting in a cut hole. With expectNets, every connection missing from the board or extra on it is an error. Wires crossing each other are fine (insulated jumpers) and only listed in notes. Fix all errors before making a link. A project sent whole is kept here: the reply's projectId stands for it in every other tool.",
  inputSchema: {project: projectInput, projectId: projectIdInput, expectNets: expectNetsInput},
  annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: false},
}, async ({project, projectId, expectNets}) => {
  const from = source({project, projectId});
  if ("error" in from) return failure(from.error);
  const {ok, project: read, problems, notes} = validateProject(from.raw, expectedNets(expectNets, from.held));
  let held = from.held;
  let leftOut = false;
  if (!held && read) {
    held = holdProject(read, {...(expectNets?.length ? {expectNets} : {})});
    leftOut = problems.some(p => p.message.includes("was left out") || p.message.includes("couldn't be read"));
  }
  return reply({
    ok,
    ...(held ? {projectId: held.id} : {}),
    ...(leftOut ? {kept: "The copy kept under projectId leaves out the entries that couldn't be read, so its wire indexes can differ from the file's."} : {}),
    ...(read ? {board: boardSummary(read.board), parts: partCount(read), wires: read.wires.length} : {}),
    problems,
    ...(notes.length ? {notes} : {}),
  });
});

server.registerTool("get_nets", {
  title: "Get nets",
  description: "Which pins the board connects: every net with its name (from its pins, e.g. GND), its pins (\"U1.8 VCC\" for a chip's pin, \"D1.K\" or \"C1.+\" for a polarized lead, \"R1.1\" otherwise) and the wires on it (indexes into wires). Also pins connected to nothing, wires that connect no pins, junctions (holes where three or more things are joined) and crossings (where a wire goes over another wire or over a hole without joining it). Wires are insulated jumpers: a wire joins only the holes at its two ends, so crossings are information, not connections or shorts. On a stripboard the strips connect too.",
  inputSchema: {project: projectInput, projectId: projectIdInput},
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project, projectId}) => {
  const from = source({project, projectId});
  if ("error" in from) return failure(from.error);
  const {project: read, wireIndex, problems} = validateProject(from.raw);
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
    projectId: projectIdInput,
    refs: z.array(z.string()).optional().describe('Only these parts, e.g. ["U1", "R2"]. All parts when omitted.'),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project, projectId, refs}) => {
  const from = source({project, projectId});
  if ("error" in from) return failure(from.error);
  let read;
  try {
    read = readProjectFile(from.raw).project;
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
  description: "Turns a project into a link that opens it in Perfboard Designer: the project travels inside the link, nothing is uploaded. Give the link to the user. The project is validated first (against expectNets too, given or remembered for its projectId); a project with errors gets the list of problems instead of a link, unless allowErrors is set.",
  inputSchema: {
    project: projectInput,
    projectId: projectIdInput,
    name: z.string().optional().describe("The project's name in the editor, e.g. \"555 LED blinker\". Defaults to the name it was given in new_project or came with from read_share_link."),
    expectNets: expectNetsInput,
    allowErrors: z.boolean().optional().describe("Make the link even if validation finds errors."),
    editorUrl: z.string().optional().describe(`The editor's address. Defaults to ${DEFAULT_EDITOR_URL} (set PERFBOARD_EDITOR_URL in the server's environment to change it); use e.g. http://localhost:3000/app/ for a local copy.`),
  },
  annotations: {readOnlyHint: true, openWorldHint: false},
}, async ({project, projectId, name, expectNets, allowErrors, editorUrl}) => {
  const from = source({project, projectId});
  if ("error" in from) return failure(from.error);
  const {ok, project: read, problems} = validateProject(from.raw, expectedNets(expectNets, from.held));
  if (!read || (!ok && !allowErrors)) {
    return failure("The project has errors, so no link was made. Fix them (or set allowErrors).", problems);
  }
  let base: URL;
  try {
    base = new URL(editorUrl ?? DEFAULT_EDITOR_URL);
    if (base.protocol !== "https:" && base.protocol !== "http:") throw new Error();
  } catch {
    return failure(`editorUrl "${editorUrl ?? DEFAULT_EDITOR_URL}" isn't an http(s) address.`);
  }
  if (from.held && name) from.held.name = name;
  base.hash = "";
  const link = `${base.href}#${await makeShareFragment(read, name ?? from.held?.name)}`;
  return reply({link, characters: link.length, ...(problems.length ? {problems} : {})});
});

server.registerTool("read_share_link", {
  title: "Read share link",
  description: "Reads the project out of a Perfboard Designer share link (any of its forms: z=, json= or src=, which is downloaded), so you can look at or change a board the user shared. Returns the project as a version 3 project file, kept here under the projectId it returns: change it with edit_project.",
  inputSchema: {
    link: z.string().describe("The whole link, or just the part after #."),
  },
  annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: true},
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
    const held = holdProject(project, {...(share.name ? {name: share.name} : {})});
    return reply({projectId: held.id, ...(share.name ? {name: share.name} : {}), ...(skipped ? {skipped} : {}), project});
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

for (const [id, {title, description}] of Object.entries(EXAMPLES)) {
  server.registerResource(`example-${id}`, `perfboard://examples/${id}`, {
    title, description: `${description} new_project with example "${id}" starts a project from it.`, mimeType: "application/json",
  }, async uri => ({contents: [{uri: uri.href, mimeType: "application/json", text: json(exampleProject(id))}]}));
}

await server.connect(new StdioServerTransport());
