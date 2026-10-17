import {IDot} from "./dot.interface";
import {Point} from "./point.interface";
import type {Ic} from "../features/ic";
import type {PlacedStandardComponent} from "../features/standard-components/placed-standard-component";
import type {PlacedAdvancedComponent} from "../features/advanced-components/placed-advanced-component";

// What every part placed on the board offers, whichever of the three placement systems it comes
// from, so board-level code (hit-testing, drag, delete, undo, save) never branches on its kind.
// Drawing isn't here: the board renderer (src/board-render/) draws every part from its serialize()
// entry.
export interface PlacedPart {
  readonly kind: "ic" | "standard-component" | "advanced-component";
  // ICs lie under the holes, components stand above the wires (as the board renderer draws
  // them), so a click finds the part on top first.
  readonly layer: "under-board" | "over-wires";
  // Reference designator (R1, U2...), unique on the board. Empty until placePart, or loading a
  // project, gives it one (see project-file/part-refs.ts).
  ref: string;
  containsPoint(x: number, y: number): boolean;
  // Holes a lead or pin goes into.
  getPinPositions(): Point[];
  // Every hole the part covers. The grid is regular, so the outermost holes stand in for all.
  getOccupiedPositions(): Point[];
  // The dots the part is pinned to, in a fixed order per kind. Everything else the part draws is
  // derived from these, so replacing them is the whole move.
  getAnchorDots(): IDot[];
  setAnchorDots(dots: IDot[]): void;
  // The part's entry in the project file.
  serialize(): object;
}

// Every placed part, as a union so `kind` narrows to the concrete class.
export type Part = Ic | PlacedStandardComponent | PlacedAdvancedComponent;
export type RotatablePart = Ic | PlacedAdvancedComponent;

export function isRotatable(part: Part): part is RotatablePart {
  return part.kind !== "standard-component";
}
