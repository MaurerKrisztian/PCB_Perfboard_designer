import {LineState} from "../state/LineState";
import {ToolState} from "../state/ToolState";
import {IcState} from "../state/IcState";
import {HistoryState} from "../state/HistoryState";
import {DotState} from "../state/DotState";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";
import {ShortcutRegistry} from "./shortcut-keys";
import {changeSelectedDotColor} from "./dot";


Utils.getSafeHtmlElement<HTMLButtonElement>('changeLineColorBtn').addEventListener('click', function() {
  addColorToSelectedLine()
});

// Delete line
Utils.getSafeHtmlElement<HTMLButtonElement>('deleteLineBtn').addEventListener('click', function() {
 deleteLine();
});

export function setLineColor(color: string){
  if (LineState.selectedLine){
    LineState.selectedLine.color = color;
    redrawCanvas();
  }
}

function addColorToSelectedLine(){
  if (!LineState.selectedLine) {
    return;
  }
  const colorPicker = Utils.getSafeHtmlElement<HTMLInputElement>('colorPicker');
  colorPicker.value = Utils.normalizeColor(LineState.selectedLine.color, "#777676");
  colorPicker.oninput = colorPicker.onchange = function() {
    ToolState.activeWireColor = colorPicker.value;
    const badge = document.getElementById('activeColorBadge');
    if (badge) badge.style.background = colorPicker.value;
    if(LineState.selectedLine){
      LineState.selectedLine.color = colorPicker.value;
      redrawCanvas();
    }
  };
  colorPicker.click();
}

export function deleteLine(){
  if (IcState.selectedPlacedIc) {
    const index = IcState.placedIcs.indexOf(IcState.selectedPlacedIc);
    if (index > -1) {
      IcState.placedIcs.splice(index, 1);
      IcState.selectedPlacedIc = undefined;
      redrawCanvas();
      return;
    }
  }
  if(LineState.selectedLine) {
    const index = LineState.lines.indexOf(LineState.selectedLine);
    if(index > -1){
      // Store change
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'remove', line: LineState.selectedLine});
      HistoryState.changeIndex++;
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
    addColorToSelectedLine()
    changeSelectedDotColor()
  }, description: "Change dot/line color."})

