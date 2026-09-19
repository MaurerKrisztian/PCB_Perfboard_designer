import {LineState} from "../../state/LineState";
import {DotState} from "../../state/DotState";
import {GridConfig} from "../../state/GridConfig";
import {redrawCanvas} from "../draw-canvas";
import {Utils} from "../../utils/utils";
import {Canvas} from "../../state/Canvas";
import {resetCanvas} from "../reset-canvas";

export const widthInput = Utils.getSafeHtmlElement<HTMLInputElement>('dotMatrixWidth')
export const heightInput = Utils.getSafeHtmlElement<HTMLInputElement>('dotMatrixHeight')
const resizeBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('resizeGridBtn')
resizeBtn.addEventListener('click', function() {
  const width = parseInt(widthInput.value);
  const height = parseInt(heightInput.value);
  // Recreate the dot grid
  createDotGrid(width, height);

  // Clear all lines and redraw the canvas
  LineState.lines = [];
  redrawCanvas();
});

export function createDotGrid(horizontalDotNumbers: number, verticalDotNumbers: number) {
  Canvas.c.width = horizontalDotNumbers * GridConfig.dotSpace;
  Canvas.c.height = verticalDotNumbers * GridConfig.dotSpace;

  DotState.dots = [];
  for(let x =  GridConfig.dotSpace / 2; x < Canvas.c.width; x +=  GridConfig.dotSpace){
    for(let y =  GridConfig.dotSpace / 2; y < Canvas.c.height; y +=  GridConfig.dotSpace){
      DotState.dots.push({x: x, y: y, description: null, color: "#a4a0a0"});
    }
  }
}

// Grid Preset Buttons listener
document.querySelectorAll('#gridPresets .preset-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const w = target.getAttribute('data-w');
    const h = target.getAttribute('data-h');
    if (w && h) {
      widthInput.value = w;
      heightInput.value = h;
      createDotGrid(parseInt(w), parseInt(h));
      resetCanvas();
      redrawCanvas();
    }
  });
});
