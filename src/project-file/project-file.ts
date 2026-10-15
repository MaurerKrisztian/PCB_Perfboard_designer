import {GridPos} from "./grid";

// The project file format, version 3. Positions are grid [column, row] pairs counted from the
// top-left hole (column = left to right, row = top to bottom), not pixels, and only holes the user
// marked are listed. Older files are still read, see read-project-file.ts:
// - version 2: the same, minus the board type (always a perfboard) and part refs.
// - version 1 (no `version` field): pixel coordinates, every hole listed, the whole IC catalog.
export const PROJECT_FILE_VERSION = 3;

export type Rotation = 0 | 90 | 180 | 270;

// A perfboard has a separate copper pad around every hole: nothing is connected until it's wired.
// A stripboard has long copper strips instead, each connecting a whole line of holes.
export type BoardType = "perfboard" | "stripboard";

// Which way a stripboard's strips run. "horizontal": every hole in the same row is on one strip.
// "vertical": every hole in the same column is.
export type StripDirection = "horizontal" | "vertical";

export interface SavedPerfboard {
  type: "perfboard";
  cols: number;
  rows: number;
}

export interface SavedStripboard {
  type: "stripboard";
  cols: number;
  rows: number;
  strips: StripDirection;
  // Holes where the strip is cut (drilled through). A cut splits its strip in two, and the cut
  // hole itself connects to neither side: a lead in it is connected to nothing.
  cuts: GridPos[];
}

export type SavedBoard = SavedPerfboard | SavedStripboard;

// A hole the user marked. Purely a visual note: it says nothing about what's connected.
export interface SavedPad {
  at: GridPos;
  color?: string;
  note?: string;
}

export interface SavedWire {
  from: GridPos;
  to: GridPos;
  color?: string;
  width?: number;
}

// Every placed part has a `ref`: its reference designator (R1, C2, U1...), unique on the board
// ignoring case. See part-refs.ts.

export interface SavedIc {
  ref: string;
  name: string;
  // Pin columns and rows as placed, i.e. already swapped by any 90/270 rotation.
  widthPin: number;
  heightPin: number;
  rotation: Rotation;
  pinDescription: Record<number, string>;
  // Top-left pin.
  at: GridPos;
  // The catalog category the chip was placed from; "modules…" parts are drawn as boards. Absent in
  // files from before this was recorded.
  category?: string;
}

export interface SavedStandardComponent {
  ref: string;
  definitionId: string;
  from: GridPos;
  to: GridPos;
  value?: string;
  color?: string;
}

export interface SavedAdvancedComponent {
  ref: string;
  definitionId: string;
  // The anchor pin (the definition's pins[0]), or a grid-sizable block's top-left pin.
  at: GridPos;
  rotation: Rotation;
  rows: number;
  cols: number;
  value?: string;
}

// A user-made IC catalog entry. Loading a file adds these to the catalog (keyed by id) rather
// than replacing it.
export interface SavedCustomIc {
  id?: number;
  name: string;
  widthPin: number;
  heightPin: number;
  pinDescription: Record<number, string>;
  // Where the part is listed in the Components panel; absent in files from before the catalog.
  category?: string;
}

export interface ProjectFile {
  version: typeof PROJECT_FILE_VERSION;
  board: SavedBoard;
  pads: SavedPad[];
  wires: SavedWire[];
  // One array per kind, each in stacking order (see PartState.parts).
  placedIcs: SavedIc[];
  placedStandardComponents: SavedStandardComponent[];
  placedAdvancedComponents: SavedAdvancedComponent[];
  customIcs: SavedCustomIc[];
}
