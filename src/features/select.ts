import {ToolState} from "../state/ToolState";
import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {HistoryState} from "../state/HistoryState";
import {GridConfig} from "../state/GridConfig";
import {redrawCanvas} from "./draw-canvas";
import {Canvas} from "../state/Canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {ILine} from "../interfaces/line.interface";
import {addDescriptionToDot} from "./description";
import {PlacedStandardComponent} from "./standard-components/placed-standard-component";
import {PlacedAdvancedComponent} from "./advanced-components/placed-advanced-component";
import {getAdvancedComponentDefinition} from "./advanced-components/advanced-component-definitions";
import {updateSelectionStatus} from "./selection-status";
import {beginDrag, endDrag} from "./component-drag";
import {findPartAt, placePart, removePart} from "./placed-parts";
import {SelectionState} from "../state/SelectionState";
import {resetInteraction} from "./reset-interaction";
import {findDotAt} from "./dot-lookup";
import {mergeNewWire} from "./wire-merge";
import {canPickUpParts, isOverPlacedPart} from "./hover";
import {ViewState} from "../state/ViewState";
let isPanningBoard = false;
let panStartX = 0;
let panStartY = 0;
let startScrollLeft = 0;
let startScrollTop = 0;

// A left press on bare board (Select mode, nothing armed) may be the start of a drag-to-pan, so
// the click is held back until the pointer either moves this far (pan) or is released (click).
const PAN_DRAG_THRESHOLD = 4;
let pendingPan: {clientX: number; clientY: number; event: MouseEvent} | undefined;

function startPan(clientX: number, clientY: number) {
  const container = document.getElementById('canvas-container');
  if (!container) return;
  isPanningBoard = true;
  panStartX = clientX;
  panStartY = clientY;
  startScrollLeft = container.scrollLeft;
  startScrollTop = container.scrollTop;
  Canvas.c.style.cursor = 'grabbing';
}

// What a plain click on bare board does: drop any part selection, then select the hole or wire
// under the pointer.
function clickBareBoard(e: MouseEvent) {
  SelectionState.clear("part");
  setSelection(e);
  redrawCanvas();
}

Canvas.c.addEventListener('mousedown', function(e) {
  // Middle button, or left button while Space is held, always pans.
  if (e.button === 1 || (e.button === 0 && ViewState.spacePanHeld)) {
    e.preventDefault();
    startPan(e.clientX, e.clientY);
    return;
  }

  if (e.button === 0) {
    hideContextMenu();
    const {x, y} = Canvas.toDrawingCoordinates(e);
    
    // Eraser Tool Mode
    if (ToolState.activeToolMode === 'eraser') {
      const part = findPartAt(x, y);
      if (part) {
        removePart(part);
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

    const armed = ToolState.armed;
    const hoverDot = DotState.hoverDot;

    // Placing a new IC from catalog template
    if (armed?.kind === "ic" && hoverDot) {
      const newInstance = armed.template.clone();
      newInstance.updatePosition(hoverDot.x, hoverDot.y);
      placePart(newInstance);
      ToolState.armed = undefined;
      redrawCanvas();
      return;
    }

    // Placing a new Standard Component from catalog (two-click span, stays armed for repeated placement)
    if (armed?.kind === "standard-component" && hoverDot) {
      if (!armed.start) {
        armed.start = hoverDot;
        redrawCanvas();
        return;
      }
      if (armed.start !== hoverDot) {
        placePart(new PlacedStandardComponent(armed.definitionId, armed.start, hoverDot));
      }
      armed.start = undefined;
      redrawCanvas();
      return;
    }

    // Placing a new Advanced (fixed-pin) Component from catalog: pins are rigid, so a
    // single click anchors the component using the current armed rotation, matching IC placement.
    // The exception is a gridSizable part (header pins), whose block size is chosen by the user:
    // that takes two clicks to span opposite corners, like a wire or a standard component.
    if (armed?.kind === "advanced-component" && hoverDot) {
      const armedDef = getAdvancedComponentDefinition(armed.definitionId);
      if (armedDef?.gridSizable) {
        if (!armed.start) {
          armed.start = hoverDot;
          redrawCanvas();
          return;
        }
        const startDot = armed.start;
        const endDot = hoverDot;
        // The lattice grows right/down from its anchor, so the anchor has to be the top-left
        // corner of the spanned rect - neither clicked dot is it when spanning up and/or left.
        const anchorDot = findDotAt(
          Math.min(startDot.x, endDot.x),
          Math.min(startDot.y, endDot.y)
        );
        if (anchorDot) {
          const {rows, cols} = PlacedAdvancedComponent.gridSpanFromDots(startDot, endDot);
          // Always unrotated: the spanned rect already fixes the block's orientation, and a
          // rotation would swing the lattice off the holes the user just picked.
          const block = new PlacedAdvancedComponent(armed.definitionId, anchorDot, 0);
          block.rows = rows;
          block.cols = cols;
          placePart(block);
        }
        // Stays armed for repeated placement, matching the standard component/wire flow.
        armed.start = undefined;
        redrawCanvas();
        return;
      }
      placePart(new PlacedAdvancedComponent(armed.definitionId, hoverDot, armed.rotation));
      redrawCanvas();
      return;
    }

    // Placing a new Wire (two-click span, stays armed for repeated placement)
    if (armed?.kind === "wire" && hoverDot) {
      if (!armed.start) {
        armed.start = hoverDot;
        redrawCanvas();
        return;
      }
      if (armed.start !== hoverDot) {
        const newLine: ILine = {
          start: armed.start,
          end: hoverDot,
          color: ToolState.activeWireColor || "#3b82f6",
          width: ToolState.selectedWireWidth || 4
        };
        // Same-color wires that end up collinear and touching (e.g. a chained run) fold into
        // one wire, unless the shared dot is a pin - that endpoint has to stay splittable.
        const {line: placedLine, absorbed} = mergeNewWire(newLine);
        LineState.lines.push(placedLine);
        HistoryState.record(absorbed.length > 0
          ? {type: 'merge', kind: 'line', removed: absorbed, merged: placedLine}
          : {type: 'add', kind: 'line', line: placedLine});
        SelectionState.current = {kind: "line", line: placedLine};
        // Chain the run: the end pad becomes the next wire's start, so a series of
        // connections costs one click per wire instead of two.
        armed.start = hoverDot;
      } else {
        // Clicking the same pad again ends the run without drawing anything.
        armed.start = undefined;
      }
      redrawCanvas();
      updateSelectionStatus();
      return;
    }

    // Bare board with nothing armed: wait and see whether this is a click or a drag-to-pan.
    if (canPickUpParts() && !isOverPlacedPart(x, y)) {
      pendingPan = {clientX: e.clientX, clientY: e.clientY, event: e};
      return;
    }

    // Skip IC/Standard Component select & drag while actively wiring, so a click on a pin/terminal
    // dot connects a wire there instead of being swallowed as "select the parent component."
    if (armed?.kind !== "wire") {
      // A hit on a placed part selects it and picks it up for dragging.
      const part = findPartAt(x, y);
      if (part) {
        SelectionState.current = {kind: "part", part};
        beginDrag(part, x, y);
        redrawCanvas();
        return;
      }
      // Missed every part: drop the part selection and fall through to dot/line selection.
      SelectionState.clear("part");
    }

    setSelection(e);
  }
});

window.addEventListener('mousemove', (e) => {
  if (pendingPan && Math.hypot(e.clientX - pendingPan.clientX, e.clientY - pendingPan.clientY) >= PAN_DRAG_THRESHOLD) {
    // It's a drag: pan from where the press started (so the board doesn't jump), and drop the click.
    startPan(pendingPan.clientX, pendingPan.clientY);
    pendingPan = undefined;
  }
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
  if (pendingPan) {
    // Released without moving: it was a plain click after all.
    const {event} = pendingPan;
    pendingPan = undefined;
    clickBareBoard(event);
  }
  if (isPanningBoard) {
    isPanningBoard = false;
    Canvas.c.style.cursor = ViewState.spacePanHeld ? 'grab' : 'crosshair';
  }
  endDrag();
});

// Hold Space + drag to pan in any mode (as in Figma/Photoshop). A held modifier rather than a
// one-shot action, so it's tracked here instead of being an entry in ShortcutRegistry.
function isTextEntry(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function releaseSpacePan() {
  ViewState.spacePanHeld = false;
  if (!isPanningBoard) Canvas.c.style.cursor = 'crosshair';
}

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || isTextEntry(e.target)) return;
  // Stops the page from scrolling, and a focused toolbar button from being "clicked" by Space.
  e.preventDefault();
  if (e.repeat) return;
  ViewState.spacePanHeld = true;
  if (!isPanningBoard) Canvas.c.style.cursor = 'grab';
});

window.addEventListener('keyup', (e) => {
  if (e.code !== 'Space' || isTextEntry(e.target)) return;
  e.preventDefault();
  releaseSpacePan();
});

// Letting go of Space in another window would never reach us.
window.addEventListener('blur', releaseSpacePan);

// Right click context menu handler
Canvas.c.addEventListener('contextmenu', function(e) {
  e.preventDefault();

  const {x, y} = Canvas.toDrawingCoordinates(e);

  const part = findPartAt(x, y);
  if (part) {
    SelectionState.current = {kind: "part", part};
    redrawCanvas();
    showContextMenu(e.clientX, e.clientY);
    return;
  }

  // The menu now acts on a wire or pad, so a part selected earlier mustn't be what Delete hits.
  SelectionState.clear("part");
  selectLine(e);
  if (!SelectionState.line) {
    SelectionState.current = DotState.hoverDot ? {kind: "dot", dot: DotState.hoverDot} : undefined;
    redrawCanvas();
  }

  if (SelectionState.line || SelectionState.dot) {
    showContextMenu(e.clientX, e.clientY);
  } else {
    hideContextMenu();
  }
});

function handleEraserClick(event: MouseEvent) {
  // If clicking on line or near line, remove line
  selectLine(event);
  const line = SelectionState.line;
  if (line) {
    const index = LineState.lines.indexOf(line);
    if (index > -1) {
      HistoryState.record({type: 'remove', kind: 'line', line});
      LineState.lines.splice(index, 1);
      SelectionState.clear();
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
  hideLedColorMenu();
}

export function showLedColorMenu() {
  const menu = document.getElementById('ledColorMenu');
  const contextMenu = document.getElementById('contextMenu');
  if (!menu) return;
  if (contextMenu) {
    // Reuse the position the right-click context menu was already shown at.
    menu.style.left = contextMenu.style.left;
    menu.style.top = contextMenu.style.top;
    contextMenu.style.display = 'none';
  }
  menu.style.display = 'block';
}

export function hideLedColorMenu() {
  const menu = document.getElementById('ledColorMenu');
  if (menu) {
    menu.style.display = 'none';
  }
}

window.addEventListener('click', (e) => {
  const menu = document.getElementById('contextMenu');
  const ledColorMenu = document.getElementById('ledColorMenu');
  if (menu && !menu.contains(e.target as Node) && ledColorMenu && !ledColorMenu.contains(e.target as Node)) {
    hideContextMenu();
  }
});

// Perpendicular distance from (x,y) to the segment, clamped to the segment itself - used to
// rank "how close is this click to this wire" rather than just "is it within tolerance."
function distanceToSegment(x: number, y: number, line: ILine): number {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(x - line.start.x, y - line.start.y);
  }
  const t = Math.max(0, Math.min(1, ((x - line.start.x) * dx + (y - line.start.y) * dy) / lengthSq));
  return Math.hypot(x - (line.start.x + t * dx), y - (line.start.y + t * dy));
}

function findLineAt(x: number, y: number): ILine | undefined {
  let closest: ILine | undefined;
  let closestDistance = GridConfig.lineSelectTolerance;
  for (const line of LineState.lines) {
    const distance = distanceToSegment(x, y, line);
    if (distance < closestDistance) {
      closest = line;
      closestDistance = distance;
    }
  }
  return closest;
}

function selectDot(){
  if (!DotState.hoverDot){
    return;
  }
  SelectionState.current = {kind: "dot", dot: DotState.hoverDot};
  redrawCanvas();
}

// A hovered dot only outranks a wire under the cursor when the click actually lands on the
// dot itself (dotClickPriorityRadius) - otherwise the dot's generous hover/snap radius would
// swallow clicks on most of a short wire, since wires span only 50px between dots.
function dotOutranksLineAt(x: number, y: number): boolean {
  if (!DotState.hoverDot) {
    return false;
  }
  return Math.hypot(x - DotState.hoverDot.x, y - DotState.hoverDot.y) <= GridConfig.dotClickPriorityRadius;
}

export function selectLine(event: MouseEvent) {
  const {x, y} = Canvas.toDrawingCoordinates(event);

  if (dotOutranksLineAt(x, y)) {
    SelectionState.clear("line");
    return;
  }

  const line = findLineAt(x, y);
  if (line) {
    SelectionState.current = {kind: "line", line};
  } else {
    SelectionState.clear("line");
  }
  redrawCanvas();
}

function setSelection(event: MouseEvent) {
  const {x, y} = Canvas.toDrawingCoordinates(event);

  if (!dotOutranksLineAt(x, y)) {
    const line = findLineAt(x, y);
    if (line) {
      SelectionState.current = {kind: "line", line};
      redrawCanvas();
      return;
    }
  }

  selectDot();
  if (!DotState.hoverDot) {
    SelectionState.clear("line");
    redrawCanvas();
  }
}

ShortcutRegistry.add({key: "Escape", description: "Unselect dot or line", event: ()=>{
  // Mid-run, Escape only breaks the chain and leaves the wire tool armed, so ending a
  // run does not cost a re-arm. A second press falls through and disarms it.
  const armed = ToolState.armed;
  if (armed?.kind === "wire" && armed.start) {
    armed.start = undefined;
    updateSelectionStatus();
    redrawCanvas();
    return;
  }
  resetInteraction();
  hideContextMenu();
  redrawCanvas();
}});