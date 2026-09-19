import {PlacedAdvancedComponent} from "../features/advanced-components/placed-advanced-component";

export class AdvancedComponentState {
  static armedDefinitionId?: string;
  static armedRotation: 0 | 90 | 180 | 270 = 0;
  static placedComponents: PlacedAdvancedComponent[] = [];
  static selectedPlacedComponent?: PlacedAdvancedComponent;
}
