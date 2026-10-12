import {ILine} from "../interfaces/line.interface";

export class LineState {
  static lines: ILine[] = [];
  static hoverLine?: ILine;
}
