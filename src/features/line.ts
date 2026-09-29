import {LineState} from "../state/LineState";
import {IcState} from "../state/IcState";
import {HistoryState} from "../state/HistoryState";
import {DotState} from "../state/DotState";
import {redrawCanvas} from "./draw-canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {changeSelectedDotColor} from "./dot";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";

export function setLineColor(color: string){
  if (LineState.selectedLine){
    LineState.selectedLine.color = color;
    redrawCanvas();
  }
}

export function deleteLine(){
  if (IcState.selectedPlacedIc) {
    const index = IcState.placedIcs.indexOf(IcState.selectedPlacedIc);
    if (index > -1) {
      const removedIc = IcState.selectedPlacedIc;
      IcState.placedIcs.splice(index, 1);
      IcState.selectedPlacedIc = undefined;
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'remove', kind: 'ic', ic: removedIc});
      HistoryState.changeIndex++;
      redrawCanvas();
      return;
    }
  }
  if (StandardComponentState.selectedPlacedComponent) {
    const index = StandardComponentState.placedComponents.indexOf(StandardComponentState.selectedPlacedComponent);
    if (index > -1) {
      const removedComponent = StandardComponentState.selectedPlacedComponent;
      StandardComponentState.placedComponents.splice(index, 1);
      StandardComponentState.selectedPlacedComponent = undefined;
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'remove', kind: 'standard-component', component: removedComponent});
      HistoryState.changeIndex++;
      redrawCanvas();
      return;
    }
  }
  if (AdvancedComponentState.selectedPlacedComponent) {
    const index = AdvancedComponentState.placedComponents.indexOf(AdvancedComponentState.selectedPlacedComponent);
    if (index > -1) {
      const removedComponent = AdvancedComponentState.selectedPlacedComponent;
      AdvancedComponentState.placedComponents.splice(index, 1);
      AdvancedComponentState.selectedPlacedComponent = undefined;
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'remove', kind: 'advanced-component', component: removedComponent});
      HistoryState.changeIndex++;
      redrawCanvas();
      return;
    }
  }
  if(LineState.selectedLine) {
    const index = LineState.lines.indexOf(LineState.selectedLine);
    if(index > -1){
      // Store change
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'remove', kind: 'line', line: LineState.selectedLine});
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
    changeSelectedDotColor()
  }, description: "Change dot color."})

