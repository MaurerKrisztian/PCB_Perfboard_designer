import {Ic} from "../features/ic";
import {PlacedStandardComponent} from "../features/standard-components/placed-standard-component";
import {PlacedAdvancedComponent} from "../features/advanced-components/placed-advanced-component";

// The three placement systems all move the same way - their anchor dot(s) translate by a whole
// number of grid steps - so one union lets a single drag implementation serve all of them.
export type IDragTarget =
  | {kind: "ic"; ic: Ic}
  | {kind: "standard-component"; component: PlacedStandardComponent}
  | {kind: "advanced-component"; component: PlacedAdvancedComponent};
