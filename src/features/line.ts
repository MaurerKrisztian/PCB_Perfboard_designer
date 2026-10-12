import {LineState} from "../state/LineState";
import {HistoryState} from "../state/HistoryState";
import {DotState} from "../state/DotState";
import {redrawCanvas} from "./draw-canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {changeSelectedDotColor} from "./dot";
import {removePart} from "./placed-parts";
import {PartState} from "../state/PartState";

export function setLineColor(color: string){
  if (LineState.selectedLine){
    LineState.selectedLine.color = color;
    redrawCanvas();
  }
}

// Deletes whatever is selected: a placed part, else a wire, else a pad's color and note.
export function deleteLine(){
  const part = PartState.selected;
  if (part && removePart(part)) {
    redrawCanvas();
    return;
  }
  if(LineState.selectedLine) {
    const index = LineState.lines.indexOf(LineState.selectedLine);
    if(index > -1){
      HistoryState.record({type: 'remove', kind: 'line', line: LineState.selectedLine});
      // Remove line
      LineState.lines.splice(index, 1);
      LineState.selectedLine = undefined;
      redrawCanvas();
      return;
    }
  }
  if (DotState.selectedDot) {
    DotState.selectedDot.color = "#a4a0a0";
    DotState.selectedDot.description = undefined;
    DotState.selectedDot = undefined;
    redrawCanvas();
  }
}

ShortcutRegistry.add({key: "Delete", event: deleteLine, description: "Delete line."})
ShortcutRegistry.add({key: "c", event: () => {
    changeSelectedDotColor()
  }, description: "Change dot color."})

