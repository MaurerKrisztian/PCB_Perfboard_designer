import {ILine} from "./line.interface";
import {Ic} from "../features/ic";
import {PlacedStandardComponent} from "../features/standard-components/placed-standard-component";
import {PlacedAdvancedComponent} from "../features/advanced-components/placed-advanced-component";

export type IChange =
  | { type: "add" | "remove"; kind: "line"; line: ILine }
  | { type: "add" | "remove"; kind: "ic"; ic: Ic }
  | { type: "add" | "remove"; kind: "standard-component"; component: PlacedStandardComponent }
  | { type: "add" | "remove"; kind: "advanced-component"; component: PlacedAdvancedComponent };
