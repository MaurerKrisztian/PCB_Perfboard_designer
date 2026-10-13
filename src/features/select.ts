import {ToolState} from "../state/ToolState";
import {DotState} from "../state/DotState";
import {redrawCanvas} from "./draw-canvas";
import {Canvas} from "../state/Canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {updateSelectionStatus} from "./selection-status";
import {endDrag} from "./component-drag";
import {findPartAt} from "./placed-parts";
import {SelectionState} from "../state/SelectionState";
import {resetInteraction} from "./reset-interaction";
import {canPickUpParts, isOverPlacedPart} from "./hover";
import {ViewState} from "../state/ViewState";
import {selectAt, selectLine, setSelection} from "./board-selection";
import {behaviorOf} from "./tools";

// Board input: routes left clicks to the active tool (src/features/tools/), and owns panning,
// the right-click context menu and Escape.

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
  const {x, y} = Canvas.toDrawingCoordinates(e);
  SelectionState.clear("part");
  setSelection(x, y);
  redrawCanvas();
  updateSelectionStatus();
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

    // Select mode on bare board: wait and see whether this is a click or a drag-to-pan.
    if (canPickUpParts() && !isOverPlacedPart(x, y)) {
      pendingPan = {clientX: e.clientX, clientY: e.clientY, event: e};
      return;
    }

    const tool = ToolState.active;
    if (!behaviorOf(tool).onPointerDown(tool, {x, y, hoverDot: DotState.hoverDot})) {
      // A placement tool clicked away from any pad: plain selection instead. The wire tool
      // doesn't pick parts up, so a slightly-off click near a pin can't grab the whole part
      // mid-run.
      selectAt(x, y, tool.kind !== "wire");
    }
    redrawCanvas();
    updateSelectionStatus();
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
  selectLine(x, y);
  if (!SelectionState.line) {
    SelectionState.current = DotState.hoverDot ? {kind: "dot", dot: DotState.hoverDot} : undefined;
  }
  redrawCanvas();

  if (SelectionState.line || SelectionState.dot) {
    showContextMenu(e.clientX, e.clientY);
  } else {
    hideContextMenu();
  }
});

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

ShortcutRegistry.add({key: "Escape", description: "Unselect dot or line", event: ()=>{
  // A tool may step back first (e.g. the wire tool ends its run but stays armed); otherwise
  // Escape drops the placement tool and the selection.
  const tool = ToolState.active;
  if (behaviorOf(tool).stepBack?.(tool)) {
    updateSelectionStatus();
    redrawCanvas();
    return;
  }
  resetInteraction();
  hideContextMenu();
  redrawCanvas();
}});