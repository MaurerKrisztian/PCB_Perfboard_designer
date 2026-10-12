import {IChange} from "../interfaces/change.interface";

export class HistoryState {
  static changes: IChange[] = [];
  static changeIndex = -1;

  // Records a change that has just been applied, dropping any redo tail past the current point.
  static record(change: IChange) {
    HistoryState.changes.splice(HistoryState.changeIndex + 1);
    HistoryState.changes.push(change);
    HistoryState.changeIndex++;
  }

  // For when the board is replaced wholesale: the recorded changes point at parts and dots that
  // are no longer on it, so replaying them would corrupt the new board.
  static clear() {
    HistoryState.changes = [];
    HistoryState.changeIndex = -1;
  }
}
