import {onRedraw} from "../draw-canvas";
import {getSaveJson} from "./save-project";
import {loadProject} from "./load-project";
import {ProjectState} from "../../state/ProjectState";
import {ProjectFile} from "../../project-file/project-file";
import {ProjectFileError, readProjectFile, ReadProjectResult} from "../../project-file/read-project-file";
import {
  createStoredProject, deleteStoredProject, getLastOpenProjectId, getStoredProject, listStoredProjects,
  migrateLegacySave, readStoredProjectFile, renameStoredProject, setLastOpenProjectId, unusedProjectName,
  writeStoredProjectFile,
} from "./project-store";

// Which stored project the board is, and keeping it saved. Every change to the board ends in a
// redraw, so a redraw schedules a save of the open project; hovering redraws too, so a save only
// writes when the project changed. Opening another project saves the one being left first.

export const DEFAULT_PROJECT_NAME = "Untitled project";
const SAVE_DELAY_MS = 500;

let pendingSave: number | undefined;
// The open project's file as last written or opened, to tell a real change from a redraw.
let lastSaved: string | undefined;

const changeListeners: (() => void)[] = [];

// Called when another project is opened, or the open one is renamed.
export function onProjectChange(listener: () => void) {
  changeListeners.push(listener);
}

function setCurrent(project: {id: string; name: string} | undefined) {
  ProjectState.current = project;
  changeListeners.forEach(listener => listener());
}

export function saveNow() {
  window.clearTimeout(pendingSave);
  pendingSave = undefined;
  const project = ProjectState.current;
  if (!project) return;
  const json = JSON.stringify(getSaveJson());
  if (json === lastSaved) return;
  try {
    writeStoredProjectFile(project.id, json, project.name);
    lastSaved = json;
  } catch (e) {
    console.error("Can't autosave the project to local storage.", e);
  }
}

// Timed from the first redraw after a save rather than the last, so a stream of redraws (moving
// the mouse, dragging a part) can't keep putting the save off.
function scheduleSave() {
  if (pendingSave === undefined) pendingSave = window.setTimeout(saveNow, SAVE_DELAY_MS);
}

onRedraw(scheduleSave);

// A tab being closed or sent to the background may never get to run the pending save.
window.addEventListener("pagehide", saveNow);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveNow();
});

function whyUnreadable(err: unknown): string {
  return err instanceof ProjectFileError ? err.message : "It isn't a valid project file.";
}

function reportSkipped(what: string, skipped: number) {
  if (skipped > 0) {
    alert(`Opened "${what}", but ${skipped} item${skipped === 1 ? "" : "s"} couldn't be read and ${skipped === 1 ? "was" : "were"} left out.`);
  }
}

// Opens a stored project, after saving the one being left. Returns false, telling the user why
// and leaving the board as it was, if the project can't be read.
export function openProject(id: string): boolean {
  const name = getStoredProject(id)?.name ?? DEFAULT_PROJECT_NAME;
  saveNow();
  let skipped: number;
  try {
    ({skipped} = loadProject(JSON.parse(readStoredProjectFile(id) ?? "null")));
  } catch (err) {
    console.error(err);
    alert(`Couldn't open "${name}". ${whyUnreadable(err)}`);
    return false;
  }
  lastSaved = JSON.stringify(getSaveJson());
  setLastOpenProjectId(id);
  setCurrent({id, name});
  reportSkipped(name, skipped);
  return true;
}

// Stores `project` as a new project called `name` and opens it. If the browser won't store it,
// it's opened anyway, unsaved, so the user still gets what they asked for.
function createAndOpen(name: string, project: ProjectFile): boolean {
  let id: string;
  try {
    id = createStoredProject(name, JSON.stringify(project)).id;
  } catch (e) {
    console.error(e);
    alert(`"${name}" can't be saved in this browser (its storage may be full or turned off), so changes to it won't be kept. Use Save Project to File to keep a copy.`);
    saveNow();
    loadProject(project);
    setCurrent(undefined);
    return false;
  }
  return openProject(id);
}

// Starts an empty project, on a board of the open one's type and size, and opens it.
export function newProject(name: string): boolean {
  const current = getSaveJson();
  const board = current.board.type === "stripboard" ? {...current.board, cuts: []} : current.board;
  return createAndOpen(name, {
    ...current, board, pads: [], wires: [], placedIcs: [], placedStandardComponents: [], placedAdvancedComponents: [],
  });
}

// Opens a project file the user picked as a new stored project, named after the file.
export function importProjectFile(text: string, fileName: string) {
  let read: ReadProjectResult;
  try {
    read = readProjectFile(JSON.parse(text));
  } catch (err) {
    console.error(err);
    alert(`Couldn't open "${fileName}". ${whyUnreadable(err)}`);
    return;
  }
  createAndOpen(unusedProjectName(fileName.replace(/\.json$/i, "").trim() || DEFAULT_PROJECT_NAME), read.project);
  reportSkipped(fileName, read.skipped);
}

// Stores a copy of a project as "<name> copy". The open project stays open.
export function duplicateProject(id: string) {
  if (ProjectState.current?.id === id) saveNow();
  const original = getStoredProject(id);
  const json = readStoredProjectFile(id);
  if (!original || json === null) return;
  try {
    createStoredProject(unusedProjectName(`${original.name} copy`), json);
  } catch (e) {
    console.error(e);
    alert(`Couldn't copy "${original.name}": this browser's storage may be full.`);
  }
}

export function renameProject(id: string, name: string) {
  renameStoredProject(id, name);
  if (ProjectState.current?.id === id) setCurrent({id, name});
}

// Deletes a stored project for good. Deleting the open one opens the most recently edited of the
// rest instead, or a new empty project when none are left.
export function deleteProject(id: string) {
  const wasOpen = ProjectState.current?.id === id;
  if (wasOpen) {
    // So a pending save can't bring it back.
    window.clearTimeout(pendingSave);
    pendingSave = undefined;
    setCurrent(undefined);
  }
  deleteStoredProject(id);
  if (!wasOpen) return;
  const next = listStoredProjects()[0];
  if (!next || !openProject(next.id)) newProject(unusedProjectName(DEFAULT_PROJECT_NAME));
}

// Reopens the project open last time, or else the most recently edited one, or starts the first.
// Waits for DOMContentLoaded because index.ts lays out a fresh grid after importing the feature
// modules, which would replace it.
window.addEventListener("DOMContentLoaded", () => {
  try {
    migrateLegacySave("My project");
    const lastOpen = getLastOpenProjectId();
    const id = lastOpen && getStoredProject(lastOpen) ? lastOpen : listStoredProjects()[0]?.id;
    if (id && openProject(id)) return;
    newProject(unusedProjectName(DEFAULT_PROJECT_NAME));
  } catch (e) {
    console.error("Local storage isn't available, so the board won't be saved.", e);
    setCurrent(undefined);
  }
});
