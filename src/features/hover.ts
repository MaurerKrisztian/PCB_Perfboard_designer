import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {GridConfig} from "../state/GridConfig";
import {IcState} from "../state/IcState";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {redrawCanvas} from "./draw-canvas";
import {Canvas} from "../state/Canvas";
import {Utils} from "../utils/utils";
import {ShortcutRegistry} from "./shortcut-keys";

function findHoveredComponentValue(x: number, y: number): string | undefined {
  for (const component of StandardComponentState.placedComponents) {
    if (component.value && component.containsPoint(x, y)) {
      return `${component.getDefinition()?.name}: ${component.value}`;
    }
  }
  for (const component of AdvancedComponentState.placedComponents) {
    if (component.value && component.containsPoint(x, y)) {
      return `${component.getDefinition()?.name}: ${component.value}`;
    }
  }
  return undefined;
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


  if (IcState.isDraggingIc && IcState.selectedPlacedIc) {
    IcState.selectedPlacedIc.updatePosition(x, y);
    redrawCanvas();
  } else if (DotState.hoverDot !== previousHoverDot || LineState.hoverLine !== previousHoverLine) {
    redrawCanvas();
  }

  if(DotState.hoverDot && DotState.hoverDot.description){
    Utils.getSafeHtmlElement('dotDescription').innerText = DotState.hoverDot.description;
  } else {
    Utils.getSafeHtmlElement('dotDescription').innerText = findHoveredComponentValue(x, y) || '';
  }
});


ShortcutRegistry.add({key: "m", description: "Move the point. select a point, then move the mouse pointer to another point, then press 'm'", event: ()=>{
    if (!DotState.hoverDot || !DotState.selectedDot){
      return;
    }

    DotState.dots =  DotState.dots.map((d)=>{
     if (d.x == DotState?.hoverDot?.x && d.y == DotState.hoverDot?.y){
       return { ...DotState.selectedDot, x: d.x, y: d.y};
     }
      if (d.x == DotState?.selectedDot?.x && d.y == DotState.selectedDot?.y){
        return { description: undefined, color: undefined, x: d.x, y: d.y};
      }
     return d
    });
    DotState.selectedDot = undefined
  }})
