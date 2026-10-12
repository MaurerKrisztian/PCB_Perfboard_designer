import {IDot} from "../interfaces/dot.interface";

// Placement of an advanced component in progress. Placed ones live in PartState.
export class AdvancedComponentState {
  static armedDefinitionId?: string;
  static armedRotation: 0 | 90 | 180 | 270 = 0;
  // First corner of an in-progress gridSizable (header pin) placement, awaiting its second
  // click. Unused by fixed-geometry parts, which place on a single click.
  static pendingAnchorDot?: IDot;
}
