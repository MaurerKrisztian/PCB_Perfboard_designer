import {IDot} from "../interfaces/dot.interface";
import {PlacedStandardComponent} from "../features/standard-components/placed-standard-component";

export class StandardComponentState {
  static armedDefinitionId?: string;
  static pendingStartDot?: IDot;
  static placedComponents: PlacedStandardComponent[] = [];
  static selectedPlacedComponent?: PlacedStandardComponent;
}
