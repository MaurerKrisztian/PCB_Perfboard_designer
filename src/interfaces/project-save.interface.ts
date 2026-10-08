import {ILine} from "./line.interface";
import {IDot} from "./dot.interface";
import {CustomIcData} from "../features/ic";

export interface IProjectSave {
  lines: ILine[];
  dots: IDot[];
  // The custom ICs this project was made with. Saves from before the Components catalog hold
  // every IC (built-ins too), which loading skips.
  ICs: CustomIcData[];
  placedIcs?: any[];
  placedStandardComponents?: any[];
  placedAdvancedComponents?: any[];
  canvas: {width: number, height: number};
}
