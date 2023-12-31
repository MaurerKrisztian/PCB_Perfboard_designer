import {IDot} from "../interfaces/dot.interface";
import {ILine} from "../interfaces/line.interface";
import {IChange} from "../interfaces/change.interface";
import {Ic} from "../features/ic";

export class State {

  static dotRadius = 5
  static dotSpace = 50
  static dots: IDot[] = [];
  static selectedDot?: IDot;
  static hoverDot?: IDot

  static lines: ILine[] = [];
  static selectedLine?: ILine;
  static hoverLine?: ILine;

  static changes: IChange[] = []
  static changeIndex = -1;

  static selectedIc?: Ic;


  static extraSelectionRatio = 4;
  static dotSelectionRadius = State.dotRadius * State.extraSelectionRatio;

  static lineSelectTolerance = 5;

  static canvasBackgroundColor = "#046307"
}
