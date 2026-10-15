import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {computeNets, layoutProjectWires, PROJECT_FILE_VERSION, ProjectFile, ProjectFileError, readProjectFile} from "../editor";
import {EXAMPLE_IDS, EXAMPLES, exampleProject} from "../examples";
import {editOp} from "../edit-ops";
import {applyEdits, isEditError, pinsOf} from "../edit-project";
import {HeldProject, heldProject, holdProject, replaceHeldProject, unknownProjectId} from "../project-handles";
import {expectedNets, expectNetsInput, projectIdInput, projectInput, projectSource} from "../project-source";
import {boardSummary, partCount} from "../project-summary";
import {netsReport} from "../nets-report";
import {validateProject} from "../validate";
import {failure, reply} from "../reply";
import {plural} from "../text";

// Making and changing the projects kept here: new_project, edit_project and get_project.

const DEFAULT_COLS = 30;
const DEFAULT_ROWS = 20;

export function registerProjectTools(server: McpServer) {
  server.registerTool("new_project", {
    title: "New project",
    description: "Starts a project kept here under a projectId: a blank board, or one of the example projects (perfboard://examples/...) to copy from. Returns the projectId and the project file. Then add parts and wires with edit_project, and pass the projectId to every other tool instead of the whole file.",
    inputSchema: {
      cols: z.number().int().min(1).max(500).optional().describe(`Holes across. ${DEFAULT_COLS} when left out.`),
      rows: z.number().int().min(1).max(500).optional().describe(`Holes down. ${DEFAULT_ROWS} when left out.`),
      type: z.enum(["perfboard", "stripboard"]).optional().describe("perfboard (default): a separate pad per hole. stripboard: copper strips joining every hole along each row (or column)."),
      strips: z.enum(["horizontal", "vertical"]).optional().describe("A stripboard's strips: along rows (horizontal, default) or columns."),
      name: z.string().optional().describe("The project's name, used by make_share_link."),
      example: z.enum(EXAMPLE_IDS).optional().describe(`Start from an example instead of a blank board: ${Object.entries(EXAMPLES).map(([id, e]) => `"${id}" (${e.title})`).join(", ")}.`),
    },
    annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false},
  }, async ({cols, rows, type, strips, name, example}) => {
    let project: ProjectFile;
    if (example) {
      if (cols || rows || type || strips) return failure("An example comes with its board: leave out cols, rows, type and strips, and change it with edit_project's set_board.");
      project = exampleProject(example)!;
    } else {
      if (strips && type !== "stripboard") return failure("`strips` is for a stripboard: add type \"stripboard\".");
      project = blankProject(cols ?? DEFAULT_COLS, rows ?? DEFAULT_ROWS, type === "stripboard" ? strips ?? "horizontal" : undefined);
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
    const from = projectSource({project, projectId});
    if ("error" in from) return failure(from.error);
    let held = from.held;
    if (!held) {
      const given = validateProject(from.raw);
      if (!given.project) return failure("The project couldn't be read.", given.problems);
      if (given.unreadable.length) {
        return failure("Some of the project's entries couldn't be read. Fix them first (validate_project lists them), or edit what's left: pass its projectId from validate_project.", given.problems);
      }
      held = holdProject(given.project);
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
      return failure("These ops would leave entries the editor can't read, so no change was made:", validateProject(result.project).unreadable);
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
}

// An empty board; a stripboard when it has strips.
function blankProject(cols: number, rows: number, strips?: "horizontal" | "vertical"): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    board: strips ? {type: "stripboard", cols, rows, strips, cuts: []} : {type: "perfboard", cols, rows},
    pads: [], wires: [], placedIcs: [], placedStandardComponents: [], placedAdvancedComponents: [], customIcs: [],
  };
}

// What new_project and edit_project tell the agent after a change: whether the board is valid now
// and what's wrong, and when it's valid, its nets, so it needn't call get_nets to check them.
function checkedProject(held: HeldProject) {
  const {project, expectNets} = held;
  const {ok, problems, notes} = validateProject(project, expectNets);
  const nets = ok ? netsReport(project, computeNets(project), layoutProjectWires(project), i => i) : undefined;
  return {
    projectId: held.id,
    revision: held.revision,
    board: boardSummary(project.board),
    parts: partCount(project),
    wires: project.wires.length,
    ok,
    ...(expectNets ? {checkedAgainst: `expectNets (${plural(expectNets.length, "net")})`} : {}),
    problems,
    ...(notes.length ? {notes: `${plural(notes.length, "note")} (wires crossing and the like): validate_project lists them.`} : {}),
    ...(nets
      ? {nets: nets.nets, unconnected: nets.unconnected, ...(nets.strayWires ? {strayWires: nets.strayWires} : {})}
      : {nets: "Left out while the board has errors: fix them, or call get_nets."}),
  };
}
