import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {GridConfig} from "../state/GridConfig";
import {redrawCanvas} from "./draw-canvas";
import {Canvas} from "../state/Canvas";
import {Utils} from "../utils/utils";
import {ShortcutRegistry} from "./shortcut-keys";
import {ToolState} from "../state/ToolState";
import {DragState} from "../state/DragState";
import {updateDrag} from "./component-drag";
import {ViewState} from "../state/ViewState";
import {findPartAt} from "./placed-parts";
import {DEFAULT_DOT_COLOR} from "./board-appearance";
import {PartState} from "../state/PartState";
import {SelectionState} from "../state/SelectionState";

export function isOverPlacedPart(x: number, y: number): boolean {
  return PartState.parts.some(part => part.containsPoint(x, y));
}

// Select mode with nothing armed for placement: placed parts can be dragged, and a drag on bare
// board pans it.
export function canPickUpParts(): boolean {
  return ToolState.active.kind === "select";
}

// Hint that a placed part can be picked up. Left alone while the cursor reads 'grabbing', which
// means a drag or a board pan owns it right now.
function updateDragCursor(x: number, y: number) {
  if (Canvas.c.style.cursor === 'grabbing') return;
  if (ViewState.spacePanHeld) {
    Canvas.c.style.cursor = 'grab';
    return;
  }
  Canvas.c.style.cursor = canPickUpParts() && isOverPlacedPart(x, y) ? 'move' : 'crosshair';
}

function findHoveredComponentValue(x: number, y: number): string | undefined {
  const part = findPartAt(x, y, p => p.kind !== "ic" && !!p.value);
  if (!part || part.kind === "ic") return undefined;
  return `${part.getDefinition()?.name}: ${part.value}`;
}

Canvas.c.addEventListener('mousemove', function(e) {
  const {x, y} = Canvas.toDrawingCoordinates(e);

  const previousHoverDot = DotState.hoverDot;
  const previousHoverLine = LineState.hoverLine;

  // Check if mouse is within a dot
  DotState.hoverDot = undefined;
  for(let i = 0; i < DotState.dots.length; i++) {
    const dot = DotState.dots[i];
    const dx = x - dot.x;
    const dy = y - dot.y;
    if(dx * dx + dy * dy < GridConfig.dotSelectionRadius * GridConfig.dotSelectionRadius){
      DotState.hoverDot = dot;
      break;
    }
  }

  // Check if mouse is within a line
  LineState.hoverLine = undefined;
  for(let i = 0; i < LineState.lines.length; i++) {
    const line = LineState.lines[i];
    const dx1 = line.start.x - x;
    const dy1 = line.start.y - y;
    const dx2 = line.end.x - x;
    const dy2 = line.end.y - y;
    const d1 = Math.sqrt(dx1*dx1 + dy1*dy1); // distance from start dot to point
    const d2 = Math.sqrt(dx2*dx2 + dy2*dy2); // distance from end dot to point
    const d = Math.sqrt(Math.pow(line.end.x-line.start.x, 2) + Math.pow(line.end.y-line.start.y, 2)); // distance from start dot to end dot
    if (Math.abs(d - (d1 + d2)) < GridConfig.lineSelectTolerance) { // increased tolerance to 10
      LineState.hoverLine = line;
      break;
    }
  }


  const dragMoved = DragState.target ? updateDrag(x, y) : false;
  updateDragCursor(x, y);

  if (dragMoved || DotState.hoverDot !== previousHoverDot || LineState.hoverLine !== previousHoverLine) {
    redrawCanvas();
  }

  if(DotState.hoverDot && DotState.hoverDot.description){
    Utils.getSafeHtmlElement('dotDescription').innerText = DotState.hoverDot.description;
  } else {
    Utils.getSafeHtmlElement('dotDescription').innerText = findHoveredComponentValue(x, y) || '';
  }
});


// Moves the selected pad's color and note onto the hovered pad. The pads themselves stay put:
// wires and parts are pinned to these dot objects, so replacing them would cut those links.
ShortcutRegistry.add({key: "m", description: "Move the point. select a point, then move the mouse pointer to another point, then press 'm'", event: ()=>{
  const from = SelectionState.dot;
  const to = DotState.hoverDot;
  if (!from || !to || from === to) return;
  to.color = from.color;
  to.description = from.description;
  from.color = DEFAULT_DOT_COLOR;
  from.description = undefined;
  SelectionState.clear("dot");
  redrawCanvas();
}})
