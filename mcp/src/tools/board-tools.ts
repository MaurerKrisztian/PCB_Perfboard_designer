import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {computeNets, GridPos, layoutProjectWires, partPins} from "../editor";
import {holdProject, saveHeldProject} from "../project-handles";
import {expectedNets, expectNetsInput, holeInput, projectIdInput, projectInput, projectSource, readSource} from "../project-source";
import {boardSummary, partCount} from "../project-summary";
import {netsReport} from "../nets-report";
import {renderBoard} from "../render-board";
import {validateProject} from "../validate";
import {failure, reply, textReply} from "../reply";
import {offBoard, plural} from "../text";

// Looking at a board: validate_project, get_nets, get_pin_positions and render_board. Each takes
// a project kept here or a whole file.

// Above this many holes, render_board asks for an area instead of drawing the whole board.
const MAX_RENDERED_HOLES = 6000;

export function registerBoardTools(server: McpServer) {
  server.registerTool("validate_project", {
    title: "Validate project",
    description: "Checks a project file and lists every problem with where it is: entries the editor would leave out, unknown parts, pins off the board, two parts' pins or leads in one hole, overlapping parts, wires that connect nothing (a loose end, or no pins on their net), duplicate wires, a two-lead part with both leads on one net (shorted out), a wire passing over a pin or lead without ending there (so not joined to it), IC pins and two-lead parts' leads connected to nothing, supply rails shorted together, and on a stripboard, pins shorted by a strip or sitting in a cut hole. With expectNets, every connection missing from the board or extra on it is an error. Wires crossing each other are fine (insulated jumpers) and only listed in notes. Fix all errors before making a link. A project sent whole is kept here: the reply's projectId stands for it in every other tool.",
    inputSchema: {project: projectInput, projectId: projectIdInput, expectNets: expectNetsInput},
    annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: false},
  }, async ({project, projectId, expectNets}) => {
    const from = await projectSource({project, projectId});
    if ("error" in from) return failure(from.error);
    const {ok, project: read, leftOut, problems, notes} = validateProject(from.raw, expectedNets(expectNets, from.held));
    // A file sent whole is kept as the editor reads it.
    if (from.held && expectNets) await saveHeldProject(from.held);
    const held = from.held ?? (read ? await holdProject(read, {...(expectNets?.length ? {expectNets} : {})}) : undefined);
    const keptPartly = !from.held && read && leftOut > 0;
    return reply({
      ok,
      ...(held ? {projectId: held.id} : {}),
      ...(keptPartly ? {kept: "The copy kept under projectId leaves out the entries that couldn't be read, so its wire indexes can differ from the file's."} : {}),
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
    const from = await projectSource({project, projectId});
    if ("error" in from) return failure(from.error);
    const {project: read, wireIndex, problems} = validateProject(from.raw);
    if (!read) return failure("The project couldn't be read.", problems);
    const errors = problems.filter(p => p.severity === "error").length;
    return reply({
      board: boardSummary(read.board),
      ...(errors ? {errors: `validate_project finds ${plural(errors, "error")}: these are the nets of the board as the editor would read it.`} : {}),
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
    const from = await projectSource({project, projectId});
    if ("error" in from) return failure(from.error);
    const read = readSource(from.raw);
    if ("error" in read) return failure(read.error);
    const wanted = refs?.map(ref => ref.toUpperCase());
    const parts = partPins(read.project)
      .filter(part => !wanted || wanted.includes(part.ref.toUpperCase()))
      .map(({ref, kind, part, known, pins, coveredHoles}) => ({
        ref, kind, part, ...(known ? {} : {unknownPart: true}), pins, ...(coveredHoles.length ? {coveredHoles} : {}),
      }));
    return reply({board: boardSummary(read.project.board), parts});
  });

  server.registerTool("render_board", {
    title: "Render board",
    description: "Draws the board as text, one cell per hole with column and row numbers: each part's pins by a key letter and pin number (a1, a2...), holes under a part's body, wire ends, the holes a wire runs over without joining them, strip cuts and marked holes. Below it, which part each key is and every wire with its ends and net. Use it to see where there's free space and how wires run before placing parts or routing more.",
    inputSchema: {
      project: projectInput,
      projectId: projectIdInput,
      area: z.object({from: holeInput, to: holeInput}).optional()
        .describe("Only this part of the board: two opposite corner holes. The whole board when left out."),
    },
    annotations: {readOnlyHint: true, openWorldHint: false},
  }, async ({project, projectId, area}) => {
    const from = await projectSource({project, projectId});
    if ("error" in from) return failure(from.error);
    const read = readSource(from.raw);
    if ("error" in read) return failure(read.error);
    const {cols, rows} = read.project.board;
    const pick = area && {from: [area.from[0], area.from[1]] as GridPos, to: [area.to[0], area.to[1]] as GridPos};
    const size = pick ? (Math.abs(pick.to[0] - pick.from[0]) + 1) * (Math.abs(pick.to[1] - pick.from[1]) + 1) : cols * rows;
    if (size > MAX_RENDERED_HOLES) {
      return failure(`That's ${size} holes, too many to draw at once (up to ${MAX_RENDERED_HOLES}): give \`area\`, e.g. {"from": [0, 0], "to": [59, 39]}.`);
    }
    const misses = (a: number, b: number, length: number) => Math.max(a, b) < 0 || Math.min(a, b) >= length;
    if (pick && (misses(pick.from[0], pick.to[0], cols) || misses(pick.from[1], pick.to[1], rows))) {
      return failure(`\`area\` is ${offBoard(cols, rows)}.`);
    }
    return textReply(renderBoard(read.project, pick));
  });
}
