import {GRID_PITCH_PX, GridPos, holesAlong, pxToGrid} from "./grid";
import {
  PROJECT_FILE_VERSION, ProjectFile, Rotation, SavedAdvancedComponent, SavedBoard, SavedCustomIc, SavedIc, SavedPad,
  SavedPerfboard, SavedStandardComponent, SavedWire
} from "./project-file";
import {BoardRefs, refPrefixFor} from "./part-refs";

// Reads any version of a project file into the current ProjectFile shape. Pure: no DOM and no
// editor state, so the editor (file and localStorage loads) and the 3D viewer share it.

// Thrown for anything that can't be read as a project at all. The message is shown to the user.
export class ProjectFileError extends Error {}

export interface ReadProjectResult {
  project: ProjectFile;
  // Entries left out because they were malformed or fell off the board.
  skipped: number;
}

const NOT_A_PROJECT = "This file isn't a Perfboard Designer project.";
// A bigger board almost certainly means a corrupt or hostile file, and building it would hang the
// tab. Far beyond any real perfboard (the largest preset is 29 x 43).
const MAX_BOARD_SIDE = 500;
// Version 1 stored this color on every hole the user hadn't marked.
const V1_UNMARKED_COLOR = "#a4a0a0";

type Entry = Record<string, unknown>;

function asEntry(value: unknown): Entry | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Entry : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

// Pin counts and block sizes: whole and at least 1.
function wholeCount(value: unknown): number | undefined {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}

function rotation(value: unknown): Rotation {
  const n = Number(value);
  return n === 90 || n === 180 || n === 270 ? n : 0;
}

function pinLabels(value: unknown): Record<number, string> {
  const labels: Record<number, string> = {};
  const entry = asEntry(value);
  if (!entry) return labels;
  for (const key of Object.keys(entry)) {
    const pin = Number(key);
    const label = entry[key];
    if (Number.isInteger(pin) && pin > 0 && typeof label === "string") labels[pin] = label;
  }
  return labels;
}

function readCustomIc(entry: Entry): SavedCustomIc | undefined {
  const widthPin = wholeCount(entry.widthPin);
  const heightPin = wholeCount(entry.heightPin);
  if (!widthPin || !heightPin) return undefined;
  const id = Number(entry.id);
  return {
    ...(Number.isFinite(id) && entry.id !== null && entry.id !== "" ? {id} : {}),
    name: text(entry.name) ?? "Custom IC",
    widthPin,
    heightPin,
    pinDescription: pinLabels(entry.pinDescription),
    ...(typeof entry.category === "string" ? {category: entry.category} : {}),
  };
}

// The custom IC list kept in localStorage, which uses the same entry shape as project files.
export function readCustomIcs(raw: unknown): SavedCustomIc[] {
  return Array.isArray(raw)
    ? raw.map(asEntry).map(entry => entry && readCustomIc(entry)).filter((ic): ic is SavedCustomIc => !!ic)
    : [];
}

class Reader {
  skipped = 0;

  constructor(readonly cols: number, readonly rows: number) {
    if (cols > MAX_BOARD_SIDE || rows > MAX_BOARD_SIDE) {
      throw new ProjectFileError(`This board is too large to open (the limit is ${MAX_BOARD_SIDE} x ${MAX_BOARD_SIDE} holes).`);
    }
  }

  onBoard(col: number | undefined, row: number | undefined): GridPos | undefined {
    if (col === undefined || row === undefined || !Number.isInteger(col) || !Number.isInteger(row)) return undefined;
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows ? [col, row] : undefined;
  }

  // Version 2: a [column, row] pair.
  gridPos(value: unknown): GridPos | undefined {
    return Array.isArray(value) && value.length === 2 ? this.onBoard(value[0], value[1]) : undefined;
  }

  // Version 1: pixel coordinates, which must sit exactly on a hole.
  pxPos(x: unknown, y: unknown): GridPos | undefined {
    if (typeof x !== "number" || typeof y !== "number") return undefined;
    return this.onBoard(pxToGrid(x), pxToGrid(y));
  }

  // Reads each entry of a list, leaving out (and counting) the ones `read` rejects.
  list<T>(value: unknown, read: (entry: Entry) => T | undefined): T[] {
    const result: T[] = [];
    for (const item of Array.isArray(value) ? value : []) {
      const entry = asEntry(item);
      const parsed = entry && read(entry);
      if (parsed) result.push(parsed);
      else this.skipped++;
    }
    return result;
  }

  // Marked holes only: an entry with neither a color nor a note says nothing worth keeping.
  pads(value: unknown, read: (entry: Entry) => {at?: GridPos; color?: string; note?: string}): SavedPad[] {
    const pads: SavedPad[] = [];
    for (const item of Array.isArray(value) ? value : []) {
      const entry = asEntry(item);
      if (!entry) continue;
      const {at, color, note} = read(entry);
      if (!color && !note) continue;
      if (!at) {
        this.skipped++;
        continue;
      }
      pads.push({at, ...(color ? {color} : {}), ...(note ? {note} : {})});
    }
    return pads;
  }

  // A perfboard of this size. Every version 1 and 2 board is one.
  perfboard(): SavedPerfboard {
    return {type: "perfboard", cols: this.cols, rows: this.rows};
  }

  // Version 3's board entry. Anything but a stripboard reads as a perfboard.
  board(entry: Entry): SavedBoard {
    if (entry.type !== "stripboard") return this.perfboard();
    return {
      type: "stripboard", cols: this.cols, rows: this.rows,
      strips: entry.strips === "vertical" ? "vertical" : "horizontal",
      cuts: this.cuts(entry.cuts),
    };
  }

  // A stripboard's cut holes, each listed once.
  cuts(value: unknown): GridPos[] {
    const cuts: GridPos[] = [];
    const seen = new Set<string>();
    for (const item of Array.isArray(value) ? value : []) {
      const at = this.gridPos(item);
      if (!at) {
        this.skipped++;
        continue;
      }
      const key = `${at[0]},${at[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cuts.push(at);
    }
    return cuts;
  }

  result(board: SavedBoard, project: Omit<ProjectFile, "version" | "board">): ReadProjectResult {
    giveEveryPartARef(project);
    return {project: {version: PROJECT_FILE_VERSION, board, ...project}, skipped: this.skipped};
  }
}

// Every part keeps the ref the file gives it, if that's well-formed and no earlier part took it;
// the rest are numbered after them. Version 1 and 2 files have no refs, so all their parts are
// numbered, in file order: U1, U2..., R1, R2...
function giveEveryPartARef(project: Pick<ProjectFile, "placedIcs" | "placedStandardComponents" | "placedAdvancedComponents">) {
  const parts = [
    ...project.placedIcs.map(entry => ({entry, kind: "ic" as const, definitionId: undefined})),
    ...project.placedStandardComponents.map(entry => ({entry, kind: "standard-component" as const, definitionId: entry.definitionId})),
    ...project.placedAdvancedComponents.map(entry => ({entry, kind: "advanced-component" as const, definitionId: entry.definitionId})),
  ];
  const refs = new BoardRefs();
  const unnamed = parts.filter(({entry}) => !refs.claim(entry.ref));
  for (const part of unnamed) part.entry.ref = refs.claimNext(refPrefixFor(part));
}

function optional<K extends string, V>(key: K, value: V | undefined): {[P in K]?: V} {
  return (value === undefined ? {} : {[key]: value}) as {[P in K]?: V};
}

// Versions 2 and 3: grid positions. Version 3 added the board type (with a stripboard's cuts) and
// part refs. A version 2 board is always a perfboard, and its parts are given refs on reading.
function readGridFile(data: Entry, version: 2 | 3): ReadProjectResult {
  const boardEntry = asEntry(data.board);
  const cols = boardEntry && wholeCount(boardEntry.cols);
  const rows = boardEntry && wholeCount(boardEntry.rows);
  if (!boardEntry || !cols || !rows) throw new ProjectFileError(NOT_A_PROJECT);
  const r = new Reader(cols, rows);
  const board = version === 3 ? r.board(boardEntry) : r.perfboard();

  const pads = r.pads(data.pads, entry => ({at: r.gridPos(entry.at), color: text(entry.color), note: text(entry.note)}));

  const wires = r.list<SavedWire>(data.wires, entry => {
    const from = r.gridPos(entry.from);
    const to = r.gridPos(entry.to);
    if (!from || !to) return undefined;
    return {from, to, ...optional("color", text(entry.color)), ...optional("width", positiveNumber(entry.width))};
  });

  const placedIcs = r.list<SavedIc>(data.placedIcs, entry => {
    const at = r.gridPos(entry.at);
    const widthPin = wholeCount(entry.widthPin);
    const heightPin = wholeCount(entry.heightPin);
    if (!at || !widthPin || !heightPin) return undefined;
    return {
      ref: text(entry.ref) ?? "", name: text(entry.name) ?? "Component", widthPin, heightPin,
      rotation: rotation(entry.rotation), pinDescription: pinLabels(entry.pinDescription), at,
      ...(typeof entry.category === "string" ? {category: entry.category} : {}),
    };
  });

  const placedStandardComponents = r.list<SavedStandardComponent>(data.placedStandardComponents, entry => {
    const definitionId = text(entry.definitionId);
    const from = r.gridPos(entry.from);
    const to = r.gridPos(entry.to);
    if (!definitionId || !from || !to) return undefined;
    return {ref: text(entry.ref) ?? "", definitionId, from, to, ...optional("value", text(entry.value)), ...optional("color", text(entry.color))};
  });

  const placedAdvancedComponents = r.list<SavedAdvancedComponent>(data.placedAdvancedComponents, entry => {
    const definitionId = text(entry.definitionId);
    const at = r.gridPos(entry.at);
    if (!definitionId || !at) return undefined;
    return {
      ref: text(entry.ref) ?? "", definitionId, at, rotation: rotation(entry.rotation),
      rows: wholeCount(entry.rows) ?? 1, cols: wholeCount(entry.cols) ?? 1,
      ...optional("value", text(entry.value)),
    };
  });

  const customIcs = r.list(data.customIcs, readCustomIc);

  return r.result(board, {pads, wires, placedIcs, placedStandardComponents, placedAdvancedComponents, customIcs});
}

// Version 1: pixel coordinates, every hole listed, and the whole IC catalog (built-ins included).
// Reads what the version 1 loader kept, with the same fallbacks.
function readV1(data: Entry): ReadProjectResult {
  const canvas = asEntry(data.canvas);
  const width = canvas && positiveNumber(canvas.width);
  const height = canvas && positiveNumber(canvas.height);
  const cols = width && holesAlong(width);
  const rows = height && holesAlong(height);
  if (!cols || !rows) throw new ProjectFileError(NOT_A_PROJECT);
  const r = new Reader(cols, rows);

  const pads = r.pads(data.dots, entry => {
    const color = text(entry.color);
    return {
      at: r.pxPos(entry.x, entry.y),
      color: color && color.toLowerCase() !== V1_UNMARKED_COLOR ? color : undefined,
      note: text(entry.description),
    };
  });

  const point = (value: unknown) => {
    const entry = asEntry(value);
    return entry && r.pxPos(entry.x, entry.y);
  };

  const wires = r.list<SavedWire>(data.lines, entry => {
    const from = point(entry.start);
    const to = point(entry.end);
    if (!from || !to) return undefined;
    return {from, to, ...optional("color", text(entry.color)), ...optional("width", positiveNumber(entry.width))};
  });

  const placedIcs = r.list<SavedIc>(data.placedIcs, entry => {
    const widthPin = wholeCount(entry.widthPin);
    const heightPin = wholeCount(entry.heightPin);
    const x = entry.topLeftDotX;
    const y = entry.topLeftDotY;
    if (!widthPin || !heightPin || typeof x !== "number" || typeof y !== "number") return undefined;
    // The version 1 loader snapped an IC whose corner wasn't on a hole to the nearest one.
    const nearest = (px: number, count: number) =>
      Math.min(count - 1, Math.max(0, Math.round((px - GRID_PITCH_PX / 2) / GRID_PITCH_PX)));
    return {
      ref: "", name: text(entry.name) ?? "Component", widthPin, heightPin,
      rotation: rotation(entry.rotationAngle), pinDescription: pinLabels(entry.pinDescription),
      at: [nearest(x, r.cols), nearest(y, r.rows)],
    };
  });

  const placedStandardComponents = r.list<SavedStandardComponent>(data.placedStandardComponents, entry => {
    const definitionId = text(entry.definitionId);
    const from = r.pxPos(entry.startDotX, entry.startDotY);
    const to = r.pxPos(entry.endDotX, entry.endDotY);
    if (!definitionId || !from || !to) return undefined;
    return {ref: "", definitionId, from, to, ...optional("value", text(entry.value)), ...optional("color", text(entry.color))};
  });

  const placedAdvancedComponents = r.list<SavedAdvancedComponent>(data.placedAdvancedComponents, entry => {
    const definitionId = text(entry.definitionId);
    const at = r.pxPos(entry.anchorDotX, entry.anchorDotY);
    if (!definitionId || !at) return undefined;
    return {
      ref: "", definitionId, at, rotation: rotation(entry.rotationAngle),
      rows: wholeCount(entry.rows) ?? 1, cols: wholeCount(entry.cols) ?? 1,
      ...optional("value", text(entry.value)),
    };
  });

  // Only user-made entries: the built-ins are part of the app, not the project.
  const customIcs = r.list(
    (Array.isArray(data.ICs) ? data.ICs : []).filter(ic => asEntry(ic)?.isCustom),
    readCustomIc
  );

  return r.result(r.perfboard(), {pads, wires, placedIcs, placedStandardComponents, placedAdvancedComponents, customIcs});
}

export function readProjectFile(raw: unknown): ReadProjectResult {
  const data = asEntry(raw);
  if (!data) throw new ProjectFileError(NOT_A_PROJECT);
  if (data.version === undefined) return readV1(data);
  if (data.version === 2 || data.version === 3) return readGridFile(data, data.version);
  if (typeof data.version === "number" && data.version > PROJECT_FILE_VERSION) {
    throw new ProjectFileError(
      "This project was saved by a newer version of Perfboard Designer. Reload the page to get the latest version, then open it again."
    );
  }
  throw new ProjectFileError(NOT_A_PROJECT);
}
