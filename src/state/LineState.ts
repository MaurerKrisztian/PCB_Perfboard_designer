import {ILine} from "../interfaces/line.interface";

export class LineState {
  static lines: ILine[] = [];
  static selectedLine?: ILine;
  static hoverLine?: ILine;
}
