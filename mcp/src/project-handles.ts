import {ProjectFile} from "./editor";

// Project handles: the server keeps a copy of each project an agent is working on, under an id,
// so it can check, edit and share it without sending the whole file back every call. Only a
// cache: the copy is a plain project file (get_project returns it as is), and any tool still
// takes the whole `project` instead. Where copies are kept is the ProjectStore: in memory for as
// long as the server runs (stdio), or a Durable Object per project (the Cloudflare Worker).

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

export interface ProjectStore {
  get(id: string): Promise<HeldProject | undefined>;
  put(entry: HeldProject): Promise<void>;
  // How long ids last, for the message when one isn't found.
  lifetime: string;
}

// Plenty for any session; past this the least recently used go first.
const MAX_HELD = 200;

export function memoryProjectStore(): ProjectStore {
  const held = new Map<string, HeldProject>();
  return {
    async get(id) {
      const entry = held.get(id);
      if (entry) {
        // Most recently used last.
        held.delete(id);
        held.set(id, entry);
      }
      return entry;
    },
    async put(entry) {
      held.delete(entry.id);
      held.set(entry.id, entry);
      while (held.size > MAX_HELD) held.delete(held.keys().next().value!);
    },
    lifetime: "Ids last only while the server runs (it may have restarted)",
  };
}

let store: ProjectStore = memoryProjectStore();

export function setProjectStore(next: ProjectStore): void {
  store = next;
}

const copy = (project: ProjectFile): ProjectFile => structuredClone(project);

// Hard to guess, as a hosted server keeps everyone's projects in one place.
function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `p-${Array.from(bytes, b => (b % 36).toString(36)).join("")}`;
}

export async function holdProject(project: ProjectFile, extras: {name?: string; expectNets?: string[][]} = {}): Promise<HeldProject> {
  const entry: HeldProject = {id: newId(), project: copy(project), revision: 0, ...extras};
  await store.put(entry);
  return entry;
}

export const heldProject = (id: string): Promise<HeldProject | undefined> => store.get(id.trim());

export function replaceHeldProject(entry: HeldProject, project: ProjectFile): void {
  entry.project = copy(project);
  entry.revision++;
}

// Keeps changes made to an entry (replaceHeldProject, its name or expectNets).
export const saveHeldProject = (entry: HeldProject): Promise<void> => store.put(entry);

export const unknownProjectId = (id: string) =>
  `There's no project "${id}" here. ${store.lifetime}: pass the whole \`project\` instead, or make a new one with new_project.`;
