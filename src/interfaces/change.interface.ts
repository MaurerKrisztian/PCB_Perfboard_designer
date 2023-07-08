import {ILine} from "./line.interface";

export interface IChange {
  type: string | "remove" | "add",
  line: ILine,
}
