import type {Part} from "../interfaces/placed-part.interface";

export class PartState {
  // Every placed part, in draw order. Always grouped by kind (ICs, then standard, then advanced
  // components) so the stacking stays what it has always been, and so does the save file, which
  // stores one array per kind. Add parts through addToBoard (placed-parts.ts), which keeps that.
  static parts: Part[] = [];
  static selected?: Part;
}
