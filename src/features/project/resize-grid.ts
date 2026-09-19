import {LineState} from "../../state/LineState";
import {DotState} from "../../state/DotState";
import {GridConfig} from "../../state/GridConfig";
import {redrawCanvas} from "../draw-canvas";
import {Utils} from "../../utils/utils";
import {Canvas} from "../../state/Canvas";
import {resetCanvas} from "../reset-canvas";
import {applyCanvasResolution} from "../canvas-sizing";
import {getCurrentZoom, fitToScreen} from "../view-controls";
import {GRID_PRESETS} from "./grid-presets";

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
  fitToScreen(true);
});

export function createDotGrid(horizontalDotNumbers: number, verticalDotNumbers: number) {
  Canvas.gridWidth = horizontalDotNumbers * GridConfig.dotSpace;
  Canvas.gridHeight = verticalDotNumbers * GridConfig.dotSpace;
  applyCanvasResolution(getCurrentZoom());

  DotState.dots = [];
  for(let x =  GridConfig.dotSpace / 2; x < Canvas.gridWidth; x +=  GridConfig.dotSpace){
    for(let y =  GridConfig.dotSpace / 2; y < Canvas.gridHeight; y +=  GridConfig.dotSpace){
      DotState.dots.push({x: x, y: y, description: null, color: "#a4a0a0"});
    }
  }
}

// Grid Preset Buttons
const gridPresetsContainer = Utils.getSafeHtmlElement('gridPresets');
for (const preset of GRID_PRESETS) {
  const btn = document.createElement('button');
  btn.className = 'preset-btn';
  btn.textContent = preset.label;
  btn.addEventListener('click', () => {
    widthInput.value = String(preset.w);
    heightInput.value = String(preset.h);
    createDotGrid(preset.w, preset.h);
    resetCanvas();
    redrawCanvas();
    fitToScreen(true);
  });
  gridPresetsContainer.appendChild(btn);
}
