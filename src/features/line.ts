import {LineState} from "../state/LineState";
import {HistoryState} from "../state/HistoryState";
import {redrawCanvas} from "./draw-canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {changeSelectedDotColor} from "./dot";
import {removePart} from "./placed-parts";
import {SelectionState} from "../state/SelectionState";

export function setLineColor(color: string){
  if (SelectionState.line){
    SelectionState.line.color = color;
    redrawCanvas();
  }
}

// Deletes whatever is selected: a placed part, else a wire, else a pad's color and note.
export function deleteLine(){
  const part = SelectionState.part;
  if (part && removePart(part)) {
    redrawCanvas();
    return;
  }
  if(SelectionState.line) {
    const index = LineState.lines.indexOf(SelectionState.line);
    if(index > -1){
      HistoryState.record({type: 'remove', kind: 'line', line: SelectionState.line});
      // Remove line
      LineState.lines.splice(index, 1);
      SelectionState.clear("line");
      redrawCanvas();
      return;
    }
  }
  if (SelectionState.dot) {
    SelectionState.dot.color = "#a4a0a0";
    SelectionState.dot.description = undefined;
    SelectionState.clear("dot");
    redrawCanvas();
  }
}

ShortcutRegistry.add({key: "Delete", event: deleteLine, description: "Delete line."})
ShortcutRegistry.add({key: "c", event: () => {
    changeSelectedDotColor()
  }, description: "Change dot color."})

