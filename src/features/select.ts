import {ToolState} from "../state/ToolState";
import {IcState} from "../state/IcState";
import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {HistoryState} from "../state/HistoryState";
import {GridConfig} from "../state/GridConfig";
import {redrawCanvas} from "./draw-canvas";
import {Canvas} from "../state/Canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {ILine} from "../interfaces/line.interface";
import {addDescriptionToDot} from "./description";
let isPanningBoard = false;
let panStartX = 0;
let panStartY = 0;
let startScrollLeft = 0;
let startScrollTop = 0;

Canvas.c.addEventListener('mousedown', function(e) {
  // Middle mouse click canvas panning
  if (e.button === 1) {
    e.preventDefault();
    const container = document.getElementById('canvas-container');
    if (container) {
      isPanningBoard = true;
      panStartX = e.clientX;
      panStartY = e.clientY;
      startScrollLeft = container.scrollLeft;
      startScrollTop = container.scrollTop;
      Canvas.c.style.cursor = 'grabbing';
    }
    return;
  }

  if (e.button === 0) {
    hideContextMenu();
    const rect = Canvas.c.getBoundingClientRect();
    const scaleX = Canvas.c.width / rect.width;
    const scaleY = Canvas.c.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    // Eraser Tool Mode
    if (ToolState.activeToolMode === 'eraser') {
      const placedIcIndex = IcState.placedIcs.findIndex(ic => ic.containsPoint(x, y));
      if (placedIcIndex > -1) {
        IcState.placedIcs.splice(placedIcIndex, 1);
        IcState.selectedPlacedIc = undefined;
        redrawCanvas();
        return;
      }
      handleEraserClick(e);
      return;
    }

    // Note Tool Mode
    if (ToolState.activeToolMode === 'note') {
      if (DotState.hoverDot) {
        addDescriptionToDot(DotState.hoverDot);
      }
      return;
    }

    // Placing a new IC from catalog template
    if (IcState.selectedIc && DotState.hoverDot) {
      const newInstance = IcState.selectedIc.clone();
      newInstance.updatePosition(DotState.hoverDot.x, DotState.hoverDot.y);
      IcState.placedIcs.push(newInstance);
      IcState.selectedPlacedIc = newInstance;
      IcState.selectedIc = undefined;
      redrawCanvas();
      return;
    }

    // Check hit on an existing placed IC on canvas (Enable Drag & Drop)
    const hitPlacedIc = IcState.placedIcs.find(ic => ic.containsPoint(x, y));
    if (hitPlacedIc) {
      IcState.selectedPlacedIc = hitPlacedIc;
      IcState.isDraggingIc = true;
      DotState.selectedDot = undefined;
      LineState.selectedLine = undefined;
      redrawCanvas();
      return;
    }

    // Deselect placed IC if clicking on empty space
    if (IcState.selectedPlacedIc) {
      IcState.selectedPlacedIc = undefined;
      redrawCanvas();
      // Fall through to normal dot/line selection
    }

    setSelection(e);
  }
});

window.addEventListener('mousemove', (e) => {
  if (isPanningBoard) {
    const container = document.getElementById('canvas-container');
    if (container) {
      const dx = e.clientX - panStartX;
      const dy = e.clientY - panStartY;
      container.scrollLeft = startScrollLeft - dx;
      container.scrollTop = startScrollTop - dy;
    }
  }
});

window.addEventListener('mouseup', () => {
  if (isPanningBoard) {
    isPanningBoard = false;
    Canvas.c.style.cursor = 'crosshair';
  }
  IcState.isDraggingIc = false;
});

// Right click context menu handler
Canvas.c.addEventListener('contextmenu', function(e) {
  e.preventDefault();
  selectLine(e);
  if (!LineState.selectedLine && DotState.hoverDot) {
    DotState.selectedDot = DotState.hoverDot;
    redrawCanvas();
  }

  if (LineState.selectedLine || DotState.selectedDot) {
    showContextMenu(e.clientX, e.clientY);
  } else {
    hideContextMenu();
  }
});

function handleEraserClick(event: MouseEvent) {
  // If clicking on line or near line, remove line
  selectLine(event);
  if (LineState.selectedLine) {
    const index = LineState.lines.indexOf(LineState.selectedLine);
    if (index > -1) {
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'remove', line: LineState.selectedLine});
      HistoryState.changeIndex++;
      LineState.lines.splice(index, 1);
      LineState.selectedLine = undefined;
      redrawCanvas();
      return;
    }
  }
  // If clicking dot, reset dot color and description
  if (DotState.hoverDot) {
    let changed = false;
    if (DotState.hoverDot.color && DotState.hoverDot.color !== "#a4a0a0") {
      DotState.hoverDot.color = "#a4a0a0";
      changed = true;
    }
    if (DotState.hoverDot.description) {
      DotState.hoverDot.description = undefined;
      changed = true;
    }
    if (changed) {
      redrawCanvas();
    }
  }
}

export function showContextMenu(x: number, y: number) {
  const menu = document.getElementById('contextMenu');
  if (!menu) return;
  menu.style.display = 'block';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

export function hideContextMenu() {
  const menu = document.getElementById('contextMenu');
  if (menu) {
    menu.style.display = 'none';
  }
}

window.addEventListener('click', (e) => {
  const menu = document.getElementById('contextMenu');
  if (menu && !menu.contains(e.target as Node)) {
    hideContextMenu();
  }
});

function addNewLineIfNeeded(){
    if (ToolState.activeToolMode !== 'wire') {
      return;
    }
    if (!DotState.hoverDot){
      return;
    }
    if(DotState.selectedDot && DotState.selectedDot != DotState.hoverDot){
      const newLine: ILine = {
        start: DotState.selectedDot, 
        end: DotState.hoverDot, 
        color: ToolState.activeWireColor || "#3b82f6",
        width: ToolState.selectedWireWidth || 4
      };
      LineState.lines.push(newLine);
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'add', line: newLine});
      HistoryState.changeIndex++;

      // Reset selection
      DotState.selectedDot = undefined;
      LineState.selectedLine = newLine;
      redrawCanvas();
    }
}

function selectDot(){
  if (!DotState.hoverDot){
    return;
  }
  DotState.selectedDot = DotState.hoverDot;
  LineState.selectedLine = undefined;
  redrawCanvas();
}

export function selectLine(event: MouseEvent) {
  if (DotState.hoverDot) {
    return;
  }

  const rect = Canvas.c.getBoundingClientRect();
  const scaleX = Canvas.c.width / rect.width;
  const scaleY = Canvas.c.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  for (let i = 0; i < LineState.lines.length; i++) {
    const line = LineState.lines[i];

    const dx1 = line.start.x - x;
    const dy1 = line.start.y - y;
    const dx2 = line.end.x - x;
    const dy2 = line.end.y - y;

    const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    const d = Math.sqrt(
      Math.pow(line.end.x - line.start.x, 2) + Math.pow(line.end.y - line.start.y, 2)
    );

    if (Math.abs(d - (d1 + d2)) < GridConfig.lineSelectTolerance) {
      LineState.selectedLine = line;
      DotState.selectedDot = undefined;
      redrawCanvas();
      return;
    }
  }

  DotState.selectedDot = undefined;
  LineState.selectedLine = undefined;
  redrawCanvas();
}

function setSelection(event) {
  addNewLineIfNeeded();
  selectDot();
  selectLine(event);
}

ShortcutRegistry.add({key: "Escape", description: "Unselect dot or line", event: ()=>{
  DotState.selectedDot = undefined;
  LineState.selectedLine = undefined;
  IcState.selectedIc = undefined;
  IcState.selectedPlacedIc = undefined;
  IcState.isDraggingIc = false;
  hideContextMenu();
  redrawCanvas();
}});
