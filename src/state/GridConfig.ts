export class GridConfig {
  static dotRadius = 5
  static dotSpace = 50

  static extraSelectionRatio = 4;
  static dotSelectionRadius = GridConfig.dotRadius * GridConfig.extraSelectionRatio;

  // Narrower than dotSelectionRadius on purpose: that radius is tuned for hover/snap
  // convenience while placing things, but using it to decide dot-vs-line click priority
  // let a dot's 20px halo swallow clicks on most of a short wire (wires span only 50px
  // between dots, so most of their length falls inside that halo). This tighter radius is
  // only for "does a dot at the exact click point outrank the wire under the cursor."
  static dotClickPriorityRadius = GridConfig.dotRadius + 3;

  static lineSelectTolerance = 5;

  static canvasBackgroundColor = "#046307"
}
