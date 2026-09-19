import {DotState} from "../state/DotState";
import {ToolState} from "../state/ToolState";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";

Utils.getSafeHtmlElement<HTMLButtonElement>('changeDotColorBtn').addEventListener('click', function() {
  changeSelectedDotColor()
});

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
    ToolState.activeWireColor = colorPicker.value;
    const badge = document.getElementById('activeColorBadge');
    if (badge) badge.style.background = colorPicker.value;
    if(DotState.selectedDot){
      DotState.selectedDot.color = colorPicker.value;
      redrawCanvas();
    }
  };
  colorPicker.click();
}
