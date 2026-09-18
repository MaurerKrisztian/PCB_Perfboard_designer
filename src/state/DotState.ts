import {IDot} from "../interfaces/dot.interface";

export class DotState {
  static dots: IDot[] = [];
  static selectedDot?: IDot;
  static hoverDot?: IDot;
}
