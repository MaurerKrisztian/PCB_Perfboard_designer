import {ILine} from "./line.interface";
import {IDot} from "./dot.interface";
import type {Part} from "./placed-part.interface";

// A drag records the part's anchor dots before and after (see PlacedPart.getAnchorDots), so one
// from/to shape covers every kind of part.
export type IChange =
  | { type: "add" | "remove"; kind: "line"; line: ILine }
  // A same-color, collinear wire placement absorbed one or more existing wires into itself.
  // Recorded as one entry so undo/redo treats the whole merge as a single step.
  | { type: "merge"; kind: "line"; removed: ILine[]; merged: ILine }
  | { type: "add" | "remove"; kind: "part"; part: Part }
  | { type: "move"; kind: "part"; part: Part; from: IDot[]; to: IDot[] };
