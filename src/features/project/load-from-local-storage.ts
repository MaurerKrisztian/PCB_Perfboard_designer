import {State} from "../../state/State";
import {redrawCanvas} from "../draw-canvas";

window.addEventListener('DOMContentLoaded', () => {
  if(localStorage.getItem('canvasDots') !== null && localStorage.getItem('canvasLines') !== null) {
    const dots = localStorage.getItem('canvasDots')
    const lines = localStorage.getItem('canvasLines')
    if (dots && lines){
      State.dots = JSON.parse(dots);
      State.lines = JSON.parse(lines);
    }
    redrawCanvas();
  }
});
