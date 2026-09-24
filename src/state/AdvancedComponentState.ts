import {IDot} from "../interfaces/dot.interface";
import {PlacedAdvancedComponent} from "../features/advanced-components/placed-advanced-component";

export class AdvancedComponentState {
  static armedDefinitionId?: string;
  static armedRotation: 0 | 90 | 180 | 270 = 0;
  // First corner of an in-progress gridSizable (header pin) placement, awaiting its second
  // click. Unused by fixed-geometry parts, which place on a single click.
  static pendingAnchorDot?: IDot;
  static placedComponents: PlacedAdvancedComponent[] = [];
  static selectedPlacedComponent?: PlacedAdvancedComponent;
}
