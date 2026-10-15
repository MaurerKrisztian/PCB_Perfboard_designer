import * as z from "zod";
import {ProjectFile, ProjectFileError, readProjectFile} from "./editor";
import {HeldProject, heldProject, unknownProjectId} from "./project-handles";
import {errorMessage} from "./text";

// How tools are given a project: the id of one kept here (`projectId`) or the whole file
// (`project`), plus the inputs that go with it.

export const projectInput = z.union([z.record(z.string(), z.unknown()), z.string()]).optional()
  .describe("The whole project file: a version 3 project object, or its JSON text (see the perfboard://docs/project-file resource). Give this or projectId.");

export const projectIdInput = z.string().optional()
  .describe("The id of a project kept here (from new_project, validate_project, edit_project or read_share_link), instead of sending the whole project.");

export const holeInput = z.array(z.number().int()).length(2).describe("A hole, [column, row].");

export const expectNetsInput = z.array(z.array(z.string())).optional().describe('The nets the board should make: each a list of pins written REF.pin, e.g. [["U1.8", "U1.4", "R1.1", "J1.1"], ["U1.2", "U1.6", "C1.+"]]. A pin can also be named by its label ("U1.VCC", "D1.K") or as get_nets writes it ("U1.8 VCC"). List every net of two or more pins: a pin in none of them should connect to nothing. With a projectId it\'s remembered for that project, so later checks use it too; [] forgets it.');

// The project a tool was given, not yet read: the raw file, and the copy kept here if it's one.
export type ProjectSource = {raw: unknown; held?: HeldProject} | {error: string};

export async function projectSource({project, projectId}: {project?: unknown; projectId?: string}): Promise<ProjectSource> {
  if (project !== undefined && projectId) return {error: "Give either `project` or `projectId`, not both."};
  if (projectId) {
    const held = await heldProject(projectId);
    return held ? {raw: held.project, held} : {error: unknownProjectId(projectId)};
  }
  if (project === undefined) return {error: "Give the project: its `projectId`, or the whole file as `project`."};
  if (typeof project !== "string") return {raw: project};
  try {
    return {raw: JSON.parse(project)};
  } catch (err) {
    return {error: `\`project\` is text but not valid JSON: ${errorMessage(err)}`};
  }
}

// The project as the editor reads it, or why it can't be read.
export function readSource(raw: unknown): {project: ProjectFile} | {error: string} {
  try {
    return {project: readProjectFile(raw).project};
  } catch (err) {
    return {error: err instanceof ProjectFileError ? err.message : String(err)};
  }
}

// expectNets for a check: the ones given (remembered for a kept project once it's saved; []
// forgets them), else the ones remembered.
export function expectedNets(given: string[][] | undefined, held: HeldProject | undefined): string[][] | undefined {
  if (held && given) held.expectNets = given.length ? given : undefined;
  return given?.length ? given : held?.expectNets;
}
