import {IDot} from "../interfaces/dot.interface";
import {ILine} from "../interfaces/line.interface";
import type {Part} from "../interfaces/placed-part.interface";

export type Selection =
  | {kind: "dot"; dot: IDot}
  | {kind: "line"; line: ILine}
  | {kind: "part"; part: Part};

// What's selected on the board: one pad, wire or placed part, never more than one at a time.
export class SelectionState {
  static current?: Selection;

  static get dot(): IDot | undefined {
    const current = SelectionState.current;
    return current?.kind === "dot" ? current.dot : undefined;
  }

  static get line(): ILine | undefined {
    const current = SelectionState.current;
    return current?.kind === "line" ? current.line : undefined;
  }

  static get part(): Part | undefined {
    const current = SelectionState.current;
    return current?.kind === "part" ? current.part : undefined;
  }

  // Deselects everything, or only a selection of the given kind.
  static clear(kind?: Selection["kind"]) {
    if (!kind || SelectionState.current?.kind === kind) SelectionState.current = undefined;
  }
}
