import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";


Utils.getSafeHtmlElement<HTMLButtonElement>('changeLineColorBtn').addEventListener('click', function() {
  Utils.getSafeHtmlElement<any>('colorPicker').onchange = function() {
    if(State.selectedLine){
      State.selectedLine.color = this.value;
      redrawCanvas();
    }
  }
  Utils.getSafeHtmlElement('colorPicker').click();
});

// Delete line
Utils.getSafeHtmlElement<HTMLButtonElement>('deleteLineBtn').addEventListener('click', function() {
  if(State.selectedLine){
    const index = State.lines.indexOf(State.selectedLine);
    if(index > -1){
      // Store change
      State.changes.splice(State.changeIndex + 1);
      State.changes.push({type: 'remove', line: State.selectedLine});
      State.changeIndex++;
      // Remove line
      State.lines.splice(index, 1);
      State.selectedLine = undefined;
      redrawCanvas();
    }
  } else {
    alert("Please select a line first by clicking on it");
  }
});
