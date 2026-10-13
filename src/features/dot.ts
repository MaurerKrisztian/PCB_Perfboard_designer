import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";
import {SelectionState} from "../state/SelectionState";

export function setDotColor(color: string){
  if (SelectionState.dot){
    SelectionState.dot.color = color;
    redrawCanvas();
  }
}

export function changeSelectedDotColor(){
  if (!SelectionState.dot){
    return;
  }
  const colorPicker = Utils.getSafeHtmlElement<HTMLInputElement>('colorPicker');
  colorPicker.value = Utils.normalizeColor(SelectionState.dot.color, "#a4a0a0");
  colorPicker.oninput = colorPicker.onchange = function() {
    if(SelectionState.dot){
      SelectionState.dot.color = colorPicker.value;
      redrawCanvas();
    }
  };
  colorPicker.click();
}
