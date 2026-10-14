// Projects kept in this browser's localStorage. Each has two keys of its own, so tabs working on
// different projects never write the same key:
//   project:<id>       its project file, as Save Project to File would write it
//   project-meta:<id>  {name, updatedAt}
// "current-project" holds the id of the project open last, to reopen on the next visit.
// Storage only, no editor state. Writes throw when storage is turned off or full.

export interface StoredProject {
  id: string;
  name: string;
  // When its file was last written, in ms since the epoch.
  updatedAt: number;
}

const DATA_PREFIX = "project:";
const META_PREFIX = "project-meta:";
const LAST_OPEN_KEY = "current-project";
// Where the one board was kept before there were projects.
const LEGACY_SAVE_KEY = "save";

function readMeta(id: string): StoredProject | undefined {
  const raw = localStorage.getItem(META_PREFIX + id);
  if (raw === null) return undefined;
  try {
    const meta = JSON.parse(raw);
    if (typeof meta?.name !== "string") return undefined;
    return {id, name: meta.name, updatedAt: typeof meta.updatedAt === "number" ? meta.updatedAt : 0};
  } catch {
    return undefined;
  }
}

function writeMeta({id, name, updatedAt}: StoredProject) {
  localStorage.setItem(META_PREFIX + id, JSON.stringify({name, updatedAt}));
}

export function getStoredProject(id: string): StoredProject | undefined {
  return readMeta(id);
}

// Most recently edited first. Empty when storage is turned off.
export function listStoredProjects(): StoredProject[] {
  const projects: StoredProject[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const meta = key?.startsWith(META_PREFIX) ? readMeta(key.slice(META_PREFIX.length)) : undefined;
      if (meta) projects.push(meta);
    }
  } catch (e) {
    console.error("Can't list the projects in local storage.", e);
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function readStoredProjectFile(id: string): string | null {
  return localStorage.getItem(DATA_PREFIX + id);
}

// Writes a project's file and marks it edited now. Keeps the stored name, which another tab may
// have changed; `name` is only for a project deleted in another tab meanwhile, which comes back.
export function writeStoredProjectFile(id: string, json: string, name: string) {
  localStorage.setItem(DATA_PREFIX + id, json);
  writeMeta({id, name: readMeta(id)?.name ?? name, updatedAt: Date.now()});
}

export function createStoredProject(name: string, json: string): StoredProject {
  const project = {id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), name, updatedAt: Date.now()};
  try {
    localStorage.setItem(DATA_PREFIX + project.id, json);
    writeMeta(project);
  } catch (e) {
    localStorage.removeItem(DATA_PREFIX + project.id);
    throw e;
  }
  return project;
}

export function renameStoredProject(id: string, name: string) {
  const meta = readMeta(id);
  if (meta) writeMeta({...meta, name});
}

export function deleteStoredProject(id: string) {
  localStorage.removeItem(META_PREFIX + id);
  localStorage.removeItem(DATA_PREFIX + id);
}

export function getLastOpenProjectId(): string | null {
  return localStorage.getItem(LAST_OPEN_KEY);
}

export function setLastOpenProjectId(id: string) {
  try {
    localStorage.setItem(LAST_OPEN_KEY, id);
  } catch (e) {
    console.error("Can't remember the open project in local storage.", e);
  }
}

// `base`, else `base 2`, `base 3`... whichever no stored project is called yet.
export function unusedProjectName(base: string): string {
  const taken = new Set(listStoredProjects().map(p => p.name));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// Turns the board stored before there were projects into one, and makes it the one to open.
export function migrateLegacySave(name: string) {
  const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
  if (legacy === null) return;
  const project = createStoredProject(unusedProjectName(name), legacy);
  setLastOpenProjectId(project.id);
  localStorage.removeItem(LEGACY_SAVE_KEY);
}
