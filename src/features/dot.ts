import {DotState} from "../state/DotState";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";

export function setDotColor(color: string){
  if (DotState.selectedDot){
    DotState.selectedDot.color = color;
    redrawCanvas();
  }
}

export function changeSelectedDotColor(){
  if (!DotState.selectedDot){
    return;
  }
  const colorPicker = Utils.getSafeHtmlElement<HTMLInputElement>('colorPicker');
  colorPicker.value = Utils.normalizeColor(DotState.selectedDot.color, "#a4a0a0");
  colorPicker.oninput = colorPicker.onchange = function() {
    if(DotState.selectedDot){
      DotState.selectedDot.color = colorPicker.value;
      redrawCanvas();
    }
  };
  colorPicker.click();
}
