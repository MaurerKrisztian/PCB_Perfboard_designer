import {IDot} from "../interfaces/dot.interface";
import type {Ic} from "../features/ic";

export type Rotation = 0 | 90 | 180 | 270;

// A placement tool waiting for clicks on the board. Only one can be armed at a time; `start` is
// the first click of a two-click placement, while it waits for the second.
export type ArmedTool =
  // Wire runs chain: each wire's end pad becomes the next one's start.
  | {kind: "wire"; start?: IDot}
  // A clone of the catalog entry, so rotating it before placing leaves the catalog alone.
  | {kind: "ic"; template: Ic}
  | {kind: "standard-component"; definitionId: string; start?: IDot}
  // Only grid-sizable parts (header pins) take two clicks; the rest place on one.
  | {kind: "advanced-component"; definitionId: string; rotation: Rotation; start?: IDot};

export class ToolState {
  static activeToolMode: 'select' | 'eraser' | 'note' | 'ic' = 'select';
  static armed?: ArmedTool;
  static selectedWireWidth = 4;
  static activeWireColor = "#3b82f6";

  // The armed tool's first click, while it waits for the second.
  static get pendingStart(): IDot | undefined {
    const armed = ToolState.armed;
    return armed && armed.kind !== "ic" ? armed.start : undefined;
  }
}
