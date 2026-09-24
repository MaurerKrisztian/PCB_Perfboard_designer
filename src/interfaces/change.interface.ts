import {ILine} from "./line.interface";
import {IDot} from "./dot.interface";
import {Ic} from "../features/ic";
import {PlacedStandardComponent} from "../features/standard-components/placed-standard-component";
import {PlacedAdvancedComponent} from "../features/advanced-components/placed-advanced-component";

// A drag records the part's anchor dots before and after. Every placement system anchors to a
// list of dots (see getAnchorDots), so one from/to shape covers all of them.
export type IChange =
  | { type: "add" | "remove"; kind: "line"; line: ILine }
  | { type: "add" | "remove"; kind: "ic"; ic: Ic }
  | { type: "add" | "remove"; kind: "standard-component"; component: PlacedStandardComponent }
  | { type: "add" | "remove"; kind: "advanced-component"; component: PlacedAdvancedComponent }
  | { type: "move"; kind: "ic"; ic: Ic; from: IDot[]; to: IDot[] }
  | { type: "move"; kind: "standard-component"; component: PlacedStandardComponent; from: IDot[]; to: IDot[] }
  | { type: "move"; kind: "advanced-component"; component: PlacedAdvancedComponent; from: IDot[]; to: IDot[] };
