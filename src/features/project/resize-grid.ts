import {LineState} from "../../state/LineState";
import {DotState} from "../../state/DotState";
import {GridConfig} from "../../state/GridConfig";
import {PartState} from "../../state/PartState";
import {IDot} from "../../interfaces/dot.interface";
import type {Part} from "../../interfaces/placed-part.interface";
import {redrawCanvas} from "../draw-canvas";
import {Utils} from "../../utils/utils";
import {Canvas} from "../../state/Canvas";
import {applyCanvasResolution} from "../canvas-sizing";
import {getCurrentZoom, fitToScreen} from "../view-controls";
import {GRID_PRESETS} from "./grid-presets";
import {DEFAULT_DOT_COLOR} from "../board-looks/board-look";
import {buildDotIndex, dotPositionKey} from "../dot-lookup";
import {resetForNewBoard} from "../reset-interaction";

export const widthInput = Utils.getSafeHtmlElement<HTMLInputElement>('dotMatrixWidth')
export const heightInput = Utils.getSafeHtmlElement<HTMLInputElement>('dotMatrixHeight')
const resizeBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('resizeGridBtn')
resizeBtn.addEventListener('click', function() {
  resizeBoard(parseInt(widthInput.value), parseInt(heightInput.value));
});

// Lays out a fresh grid of holes. Holes found in `keep` (by position) are reused as-is rather than
// recreated, so their color and note survive, and so do the wires and parts anchored to them.
export function createDotGrid(horizontalDotNumbers: number, verticalDotNumbers: number, keep?: Map<string, IDot>) {
  Canvas.gridWidth = horizontalDotNumbers * GridConfig.dotSpace;
  Canvas.gridHeight = verticalDotNumbers * GridConfig.dotSpace;
  applyCanvasResolution(getCurrentZoom());

  DotState.dots = [];
  for(let x =  GridConfig.dotSpace / 2; x < Canvas.gridWidth; x +=  GridConfig.dotSpace){
    for(let y =  GridConfig.dotSpace / 2; y < Canvas.gridHeight; y +=  GridConfig.dotSpace){
      DotState.dots.push(keep?.get(dotPositionKey(x, y)) ?? {x: x, y: y, description: null, color: DEFAULT_DOT_COLOR});
    }
  }
}

// Resizes the board, keeping every hole, wire and part that still fits. Whatever falls off the new
// edge is removed, after asking. Returns false if the user cancelled.
function resizeBoard(cols: number, rows: number): boolean {
  if (!(cols > 0 && rows > 0)) return false;
  const newWidth = cols * GridConfig.dotSpace;
  const newHeight = rows * GridConfig.dotSpace;
  const oldDots = buildDotIndex();
  const fitsNewBoard = (p: {x: number; y: number}) => p.x < newWidth && p.y < newHeight;

  // Same rule as dragging: a part fits when every hole it covers lands on the new board. Holes it
  // already overhung the old board with are exempt, since placement never required a part to fit.
  const partFits = (part: Part) =>
    part.getAnchorDots().every(fitsNewBoard)
    && part.getOccupiedPositions().every(p => !oldDots.has(dotPositionKey(p.x, p.y)) || fitsNewBoard(p));

  const keptLines = LineState.lines.filter(line => fitsNewBoard(line.start) && fitsNewBoard(line.end));
  const keptParts = PartState.parts.filter(partFits);

  const droppedWires = LineState.lines.length - keptLines.length;
  const droppedParts = PartState.parts.length - keptParts.length;
  if (droppedWires + droppedParts > 0) {
    const what = [
      droppedWires ? `${droppedWires} wire${droppedWires === 1 ? "" : "s"}` : "",
      droppedParts ? `${droppedParts} part${droppedParts === 1 ? "" : "s"}` : "",
    ].filter(Boolean).join(" and ");
    if (!confirm(`Resizing will remove ${what} that no longer fit on the board. This can't be undone. Continue?`)) {
      widthInput.value = String(Math.round(Canvas.gridWidth / GridConfig.dotSpace));
      heightInput.value = String(Math.round(Canvas.gridHeight / GridConfig.dotSpace));
      return false;
    }
  }

  resetForNewBoard();
  LineState.lines = keptLines;
  PartState.parts = keptParts;
  createDotGrid(cols, rows, oldDots);
  redrawCanvas();
  fitToScreen(true);
  return true;
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
    resizeBoard(preset.w, preset.h);
  });
  gridPresetsContainer.appendChild(btn);
}
