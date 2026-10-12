import {GridPos} from "./grid";

// The project file format, version 2. Positions are grid [column, row] pairs, not pixels, and
// only holes the user marked are listed. Version 1 files (no `version` field: pixel coordinates,
// every hole listed, the whole IC catalog embedded) are still read, see read-project-file.ts.
export const PROJECT_FILE_VERSION = 2;

export type Rotation = 0 | 90 | 180 | 270;

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

export interface SavedIc {
  name: string;
  // Pin columns and rows as placed, i.e. already swapped by any 90/270 rotation.
  widthPin: number;
  heightPin: number;
  rotation: Rotation;
  pinDescription: Record<number, string>;
  // Top-left pin.
  at: GridPos;
}

export interface SavedStandardComponent {
  definitionId: string;
  from: GridPos;
  to: GridPos;
  value?: string;
  color?: string;
}

export interface SavedAdvancedComponent {
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
}

export interface ProjectFile {
  version: typeof PROJECT_FILE_VERSION;
  board: {cols: number; rows: number};
  pads: SavedPad[];
  wires: SavedWire[];
  // One array per kind, each in stacking order (see PartState.parts).
  placedIcs: SavedIc[];
  placedStandardComponents: SavedStandardComponent[];
  placedAdvancedComponents: SavedAdvancedComponent[];
  customIcs: SavedCustomIc[];
}
