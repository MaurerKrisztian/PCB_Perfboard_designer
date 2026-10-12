import type {Part} from "../interfaces/placed-part.interface";
import {PartState} from "../state/PartState";
import {HistoryState} from "../state/HistoryState";

// Stacking group of each kind within PartState.parts.
const KIND_ORDER: Record<Part["kind"], number> = {"ic": 0, "standard-component": 1, "advanced-component": 2};

// Puts a part on the board, on top of the others of its kind. Records no history: for loading,
// undo/redo, and callers that record their own entry.
export function addToBoard(part: Part) {
  const rank = KIND_ORDER[part.kind];
  const index = PartState.parts.findIndex(p => KIND_ORDER[p.kind] > rank);
  PartState.parts.splice(index === -1 ? PartState.parts.length : index, 0, part);
}

// Takes a part off the board, dropping it from the selection. Records no history. Returns false
// if it wasn't on the board.
export function takeOffBoard(part: Part): boolean {
  if (PartState.selected === part) PartState.selected = undefined;
  const index = PartState.parts.indexOf(part);
  if (index < 0) return false;
  PartState.parts.splice(index, 1);
  return true;
}

// Places a new part as one undoable step, and selects it.
export function placePart(part: Part) {
  addToBoard(part);
  PartState.selected = part;
  HistoryState.record({type: "add", kind: "part", part});
}

// Removes a part as one undoable step. Returns false if it wasn't on the board.
export function removePart(part: Part): boolean {
  if (!takeOffBoard(part)) return false;
  HistoryState.record({type: "remove", kind: "part", part});
  return true;
}

// Topmost placed part under a canvas point, optionally limited to the parts `accept` allows.
// Searches in reverse draw order (see redrawCanvas: the under-board layer first, then the layer
// over the wires, each in list order), so a click lands on the part that's visibly on top.
export function findPartAt(x: number, y: number, accept?: (part: Part) => boolean): Part | undefined {
  for (const layer of ["over-wires", "under-board"] as const) {
    for (let i = PartState.parts.length - 1; i >= 0; i--) {
      const part = PartState.parts[i];
      if (part.layer === layer && part.containsPoint(x, y) && (!accept || accept(part))) return part;
    }
  }
  return undefined;
}
