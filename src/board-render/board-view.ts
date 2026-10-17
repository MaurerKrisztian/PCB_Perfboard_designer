import {GridPos} from "../project-file/grid";
import {SavedWire} from "../project-file/project-file";

// How to show a board, beyond what its project file says: which labels, and what to mark. The
// editor fills it from its selection, hover and Nets panel (src/features/board-canvas/editor-view.ts);
// everyone else (exports, thumbnails, the MCP server) mostly draws the plain board.

// One thing on the board, as the project file knows it.
export type BoardItem =
  | {kind: "part"; ref: string}
  // By index into the file's wires.
  | {kind: "wire"; index: number}
  | {kind: "hole"; at: GridPos};

export interface BoardView {
  // Each part's ref and value next to it ("R1 10kΩ"); a chip's ref goes on its body.
  partLabels?: boolean;
  selected?: BoardItem;
  // Under the pointer: a hole and a wire can both be.
  hovered?: BoardItem[];
  // The first click of a two-click placement.
  startHole?: GridPos;
  // A net lit up: its holes and wires.
  highlight?: {holes: GridPos[]; wires: SavedWire[]};
}

export const PLAIN_VIEW: BoardView = {};

export function isSameItem(a: BoardItem | undefined, b: BoardItem): boolean {
  if (!a || a.kind !== b.kind) return false;
  if (a.kind === "part" && b.kind === "part") return a.ref === b.ref;
  if (a.kind === "wire" && b.kind === "wire") return a.index === b.index;
  return a.kind === "hole" && b.kind === "hole" && a.at[0] === b.at[0] && a.at[1] === b.at[1];
}

export function isHovered(view: BoardView, item: BoardItem): boolean {
  return view.hovered?.some(hovered => isSameItem(hovered, item)) ?? false;
}
