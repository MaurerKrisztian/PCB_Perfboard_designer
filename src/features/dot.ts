import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";

Utils.getSafeHtmlElement<HTMLButtonElement>('changeDotColorBtn').addEventListener('click', function() {
  changeSelectedDotColor()
});

export function changeSelectedDotColor(){
  if (!State.selectedDot){
    return;
  }
  Utils.getSafeHtmlElement<any>('colorPicker').onchange = function() {
    if(State.selectedDot){
      State.selectedDot.color = this.value;
      redrawCanvas();
    }
  }
  Utils.getSafeHtmlElement('colorPicker').click();
}
