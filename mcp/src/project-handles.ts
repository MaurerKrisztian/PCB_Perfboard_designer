import {ProjectFile} from "./editor";

// Project handles: the server keeps a copy of each project an agent is working on, under an id,
// so it can check, edit and share it without sending the whole file back every call. Only a
// cache: the copy is a plain project file (get_project returns it as is), held in memory for as
// long as the server runs, and any tool still takes the whole `project` instead.

export interface HeldProject {
  id: string;
  project: ProjectFile;
  // Counts edits, so an agent can tell its copy is current.
  revision: number;
  // The name the share link gives it, if one was given (or came with a link that was read).
  name?: string;
  // The netlist the agent meant, given once to validate_project or edit_project: every later
  // check of this project compares against it.
  expectNets?: string[][];
}

// Plenty for any session; past this the least recently used go first.
const MAX_HELD = 200;
const held = new Map<string, HeldProject>();
let counter = 0;

const copy = (project: ProjectFile): ProjectFile => structuredClone(project);

export function holdProject(project: ProjectFile, extras: {name?: string; expectNets?: string[][]} = {}): HeldProject {
  const id = `p${++counter}-${Math.random().toString(36).slice(2, 6)}`;
  const entry: HeldProject = {id, project: copy(project), revision: 0, ...extras};
  held.set(id, entry);
  while (held.size > MAX_HELD) held.delete(held.keys().next().value!);
  return entry;
}

export function heldProject(id: string): HeldProject | undefined {
  const entry = held.get(id.trim());
  if (entry) {
    // Most recently used last.
    held.delete(entry.id);
    held.set(entry.id, entry);
  }
  return entry;
}

export function replaceHeldProject(entry: HeldProject, project: ProjectFile): void {
  entry.project = copy(project);
  entry.revision++;
}

export const unknownProjectId = (id: string) =>
  `There's no project "${id}" here. Ids last only while the server runs (it may have restarted): pass the whole \`project\` instead, or make a new one with new_project.`;
