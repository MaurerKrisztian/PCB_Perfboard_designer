import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";

Utils.getSafeHtmlElement<HTMLButtonElement>('changeDotColorBtn').addEventListener('click', function() {
  // todo: find the color picker type
  Utils.getSafeHtmlElement<any>('colorPicker').onchange = function() {
    if(State.selectedDot){
      State.selectedDot.color = this.value;
      redrawCanvas();
    }
  }
  Utils.getSafeHtmlElement('colorPicker').click();
});
