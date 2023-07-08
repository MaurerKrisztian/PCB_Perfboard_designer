import {ILine} from "./line.interface";
import {IDot} from "./dot.interface";

export interface IProjectSave {
  lines: ILine[]
  dots: IDot[];
  canvas: {width: number, height: number}
}
