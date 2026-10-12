import {GRID_PITCH_PX} from "../project-file/grid";

export class GridConfig {
  static dotRadius = 5
  // Hole pitch in drawing pixels. Shared with the project file format and the 3D viewer.
  static dotSpace = GRID_PITCH_PX

  static extraSelectionRatio = 4;
  static dotSelectionRadius = GridConfig.dotRadius * GridConfig.extraSelectionRatio;

  // Narrower than dotSelectionRadius on purpose: that radius is tuned for hover/snap
  // convenience while placing things, but using it to decide dot-vs-line click priority
  // let a dot's 20px halo swallow clicks on most of a short wire (wires span only 50px
  // between dots, so most of their length falls inside that halo). This tighter radius is
  // only for "does a dot at the exact click point outrank the wire under the cursor."
  static dotClickPriorityRadius = GridConfig.dotRadius + 3;

  static lineSelectTolerance = 5;

  // Board color; the pads drawn on it are in board-appearance.ts.
  static canvasBackgroundColor = "#046307"
}
