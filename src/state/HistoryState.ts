import {IChange} from "../interfaces/change.interface";

export class HistoryState {
  static changes: IChange[] = [];
  static changeIndex = -1;
}
