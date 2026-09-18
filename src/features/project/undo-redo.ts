import {HistoryState} from "../../state/HistoryState";
import {LineState} from "../../state/LineState";
import {IcState} from "../../state/IcState";
import {StandardComponentState} from "../../state/StandardComponentState";
import {redrawCanvas} from "../draw-canvas";
import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";
import {IChange} from "../../interfaces/change.interface";

Utils.getSafeHtmlElement<HTMLButtonElement>('backBtn').addEventListener('click', function() {
undo();
});

function applyChange(change: IChange, direction: "add" | "remove") {
  if (change.kind === "line") {
    if (direction === "add") {
      LineState.lines.push(change.line);
    } else {
      const index = LineState.lines.findIndex(l => l.start === change.line.start && l.end === change.line.end);
      if (index > -1) LineState.lines.splice(index, 1);
    }
  } else if (change.kind === "ic") {
    if (direction === "add") {
      IcState.placedIcs.push(change.ic);
    } else {
      const index = IcState.placedIcs.indexOf(change.ic);
      if (index > -1) IcState.placedIcs.splice(index, 1);
    }
  } else if (change.kind === "standard-component") {
    if (direction === "add") {
      StandardComponentState.placedComponents.push(change.component);
    } else {
      const index = StandardComponentState.placedComponents.indexOf(change.component);
      if (index > -1) StandardComponentState.placedComponents.splice(index, 1);
    }
  }
}

export function undo(){
  if(HistoryState.changeIndex >= 0){
    const change = HistoryState.changes[HistoryState.changeIndex];
    applyChange(change, change.type === "add" ? "remove" : "add");
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
    applyChange(change, change.type);
    redrawCanvas();
  }
}

ShortcutRegistry.add({key: "z", ctrl: true, description: "Undo last change.", event: undo});
ShortcutRegistry.add({key: "y", ctrl: true, description: "Redo last undo.", event: redo});
