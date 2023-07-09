import {ILine} from "./line.interface";
import {IDot} from "./dot.interface";
import {Ic} from "../features/ic";

export interface IProjectSave {
  lines: ILine[]
  dots: IDot[];
  ICs: Ic[];
  canvas: {width: number, height: number}
}
