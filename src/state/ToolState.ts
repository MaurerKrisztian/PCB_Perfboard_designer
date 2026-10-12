import {IDot} from "../interfaces/dot.interface";
import type {Ic} from "../features/ic";

export type Rotation = 0 | 90 | 180 | 270;

// What a left click on the board does: one of the toolbar's modes, or a placement tool picked
// from the wire button or a catalog. A placement tool's `start` is its first click, while it
// waits for the second. What each tool does lives in src/features/tools/.
export type ActiveTool =
  | {kind: "select"}
  | {kind: "eraser"}
  | {kind: "note"}
  // Wire runs chain: each wire's end pad becomes the next one's start.
  | {kind: "wire"; start?: IDot}
  // A clone of the catalog entry, so rotating it before placing leaves the catalog alone.
  | {kind: "ic"; template: Ic}
  | {kind: "standard-component"; definitionId: string; start?: IDot}
  // Only grid-sizable parts (header pins) take two clicks; the rest place on one.
  | {kind: "advanced-component"; definitionId: string; rotation: Rotation; start?: IDot};

// The toolbar's mode buttons. Everything else is a placement tool.
export type ToolMode = "select" | "eraser" | "note";

export function isPlacementTool(tool: ActiveTool): boolean {
  return tool.kind !== "select" && tool.kind !== "eraser" && tool.kind !== "note";
}

export class ToolState {
  static active: ActiveTool = {kind: "select"};
  static selectedWireWidth = 4;
  static activeWireColor = "#3b82f6";

  // The placement tool's first click, while it waits for the second.
  static get pendingStart(): IDot | undefined {
    const tool = ToolState.active;
    return "start" in tool ? tool.start : undefined;
  }
}
