import {HistoryState} from "../../state/HistoryState";
import {LineState} from "../../state/LineState";
import {redrawCanvas} from "../draw-canvas";
import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";
import {IChange} from "../../interfaces/change.interface";
import {addToBoard, takeOffBoard} from "../placed-parts";

Utils.getSafeHtmlElement<HTMLButtonElement>('backBtn').addEventListener('click', function() {
undo();
});

// "apply" replays the change as it originally happened, "revert" puts the board back the way it
// was before it. A move isn't expressible as an add or a remove, hence the direction rather than
// the change's own type driving this.
function applyChange(change: IChange, direction: "apply" | "revert") {
  if (change.type === "move") {
    change.part.setAnchorDots(direction === "apply" ? change.to : change.from);
    return;
  }

  if (change.type === "merge") {
    if (direction === "apply") {
      for (const removed of change.removed) {
        const index = LineState.lines.findIndex(l => l.start === removed.start && l.end === removed.end);
        if (index > -1) LineState.lines.splice(index, 1);
      }
      LineState.lines.push(change.merged);
    } else {
      const index = LineState.lines.findIndex(l => l.start === change.merged.start && l.end === change.merged.end);
      if (index > -1) LineState.lines.splice(index, 1);
      LineState.lines.push(...change.removed);
    }
    return;
  }

  const add = (change.type === "add") === (direction === "apply");
  if (change.kind === "line") {
    if (add) {
      LineState.lines.push(change.line);
    } else {
      const index = LineState.lines.findIndex(l => l.start === change.line.start && l.end === change.line.end);
      if (index > -1) LineState.lines.splice(index, 1);
    }
  } else if (add) {
    addToBoard(change.part);
  } else {
    takeOffBoard(change.part);
  }
}

export function undo(){
  if(HistoryState.changeIndex >= 0){
    const change = HistoryState.changes[HistoryState.changeIndex];
    applyChange(change, "revert");
    HistoryState.changeIndex--;
    redrawCanvas();
  }
}

// Forward button
Utils.getSafeHtmlElement<HTMLButtonElement>('forwardBtn').addEventListener('click', function() {
  redo()
});

export function redo(){
  if(HistoryState.changeIndex < HistoryState.changes.length - 1){
    HistoryState.changeIndex++;
    const change = HistoryState.changes[HistoryState.changeIndex];
    if (change == undefined){
      return;
    }
    applyChange(change, "apply");
    redrawCanvas();
  }
}

ShortcutRegistry.add({key: "z", ctrl: true, description: "Undo last change.", event: undo});
ShortcutRegistry.add({key: "y", ctrl: true, description: "Redo last undo.", event: redo});
