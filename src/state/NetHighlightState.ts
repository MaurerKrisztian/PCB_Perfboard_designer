import {GridPos} from "../project-file/grid";
import {SavedWire} from "../project-file/project-file";

export interface NetHighlight {
  // Its pins ("U1.8"), how the Nets panel finds the net again after the board changes.
  pins: string[];
  holes: GridPos[];
  wires: SavedWire[];
}

// The net picked in the Nets panel (nets-panel.ts), lit up on the board by redrawCanvas().
export class NetHighlightState {
  static current?: NetHighlight;
}
