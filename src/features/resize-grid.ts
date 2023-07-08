import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";
import {Canvas} from "../state/Canvas";

export const widthInput = Utils.getSafeHtmlElement<HTMLInputElement>('dotMatrixWidth')
export const heightInput = Utils.getSafeHtmlElement<HTMLInputElement>('dotMatrixHeight')
const resizeBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('resizeGridBtn')
resizeBtn.addEventListener('click', function() {
  const width = parseInt(widthInput.value);
  const height = parseInt(heightInput.value);

  // Set the width and height of the grid
  // gridWidth = width;
  // gridHeight = height;

  // Recreate the dot grid
  createDotGrid(width, height);

  // Clear all lines and redraw the canvas
  State.lines = [];
  redrawCanvas();
});

export function createDotGrid(width, height) {
  // Calculate the spacing based on the canvas size and the number of dots
  const xSpacing = Canvas.c.width / width;
  const ySpacing = Canvas.c.height / height;

  State.dots = [];
  for(let x = xSpacing / 2; x < Canvas.c.width; x += xSpacing){
    for(let y = ySpacing / 2; y < Canvas.c.height; y += ySpacing){
      State.dots.push({x: x, y: y, description: null, color: "#a4a0a0"});
    }
  }
}
