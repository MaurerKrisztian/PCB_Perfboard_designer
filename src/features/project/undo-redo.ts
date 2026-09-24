import {HistoryState} from "../../state/HistoryState";
import {LineState} from "../../state/LineState";
import {IcState} from "../../state/IcState";
import {StandardComponentState} from "../../state/StandardComponentState";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {redrawCanvas} from "../draw-canvas";
import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";
import {IChange} from "../../interfaces/change.interface";
import {setAnchorDots} from "../component-drag";

Utils.getSafeHtmlElement<HTMLButtonElement>('backBtn').addEventListener('click', function() {
undo();
});

// "apply" replays the change as it originally happened, "revert" puts the board back the way it
// was before it. A move isn't expressible as an add or a remove, hence the direction rather than
// the change's own type driving this.
function applyChange(change: IChange, direction: "apply" | "revert") {
  if (change.type === "move") {
    setAnchorDots(change, direction === "apply" ? change.to : change.from);
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
  } else if (change.kind === "ic") {
    if (add) {
      IcState.placedIcs.push(change.ic);
    } else {
      const index = IcState.placedIcs.indexOf(change.ic);
      if (index > -1) IcState.placedIcs.splice(index, 1);
    }
  } else if (change.kind === "standard-component") {
    if (add) {
      StandardComponentState.placedComponents.push(change.component);
    } else {
      const index = StandardComponentState.placedComponents.indexOf(change.component);
      if (index > -1) StandardComponentState.placedComponents.splice(index, 1);
    }
  } else if (change.kind === "advanced-component") {
    if (add) {
      AdvancedComponentState.placedComponents.push(change.component);
    } else {
      const index = AdvancedComponentState.placedComponents.indexOf(change.component);
      if (index > -1) AdvancedComponentState.placedComponents.splice(index, 1);
    }
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
