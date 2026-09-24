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
import {StandardComponentState} from "../state/StandardComponentState";
import {PlacedStandardComponent} from "./standard-components/placed-standard-component";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {PlacedAdvancedComponent} from "./advanced-components/placed-advanced-component";
import {getAdvancedComponentDefinition} from "./advanced-components/advanced-component-definitions";
import {disarmWire} from "./wire";
import {updateSelectionStatus} from "./selection-status";
import {beginDrag, cancelDrag, endDrag} from "./component-drag";
import {findDotAt} from "./dot-lookup";
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
    const {x, y} = Canvas.toDrawingCoordinates(e);
    
    // Eraser Tool Mode
    if (ToolState.activeToolMode === 'eraser') {
      const placedIcIndex = IcState.placedIcs.findIndex(ic => ic.containsPoint(x, y));
      if (placedIcIndex > -1) {
        const [removedIc] = IcState.placedIcs.splice(placedIcIndex, 1);
        IcState.selectedPlacedIc = undefined;
        HistoryState.changes.splice(HistoryState.changeIndex + 1);
        HistoryState.changes.push({type: 'remove', kind: 'ic', ic: removedIc});
        HistoryState.changeIndex++;
        redrawCanvas();
        return;
      }
      const placedComponentIndex = StandardComponentState.placedComponents.findIndex(c => c.containsPoint(x, y));
      if (placedComponentIndex > -1) {
        const [removedComponent] = StandardComponentState.placedComponents.splice(placedComponentIndex, 1);
        StandardComponentState.selectedPlacedComponent = undefined;
        HistoryState.changes.splice(HistoryState.changeIndex + 1);
        HistoryState.changes.push({type: 'remove', kind: 'standard-component', component: removedComponent});
        HistoryState.changeIndex++;
        redrawCanvas();
        return;
      }
      const placedAdvancedComponentIndex = AdvancedComponentState.placedComponents.findIndex(c => c.containsPoint(x, y));
      if (placedAdvancedComponentIndex > -1) {
        const [removedComponent] = AdvancedComponentState.placedComponents.splice(placedAdvancedComponentIndex, 1);
        AdvancedComponentState.selectedPlacedComponent = undefined;
        HistoryState.changes.splice(HistoryState.changeIndex + 1);
        HistoryState.changes.push({type: 'remove', kind: 'advanced-component', component: removedComponent});
        HistoryState.changeIndex++;
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
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'add', kind: 'ic', ic: newInstance});
      HistoryState.changeIndex++;
      redrawCanvas();
      return;
    }

    // Placing a new Standard Component from catalog (two-click span, stays armed for repeated placement)
    if (StandardComponentState.armedDefinitionId && DotState.hoverDot) {
      if (!StandardComponentState.pendingStartDot) {
        StandardComponentState.pendingStartDot = DotState.hoverDot;
        redrawCanvas();
        return;
      }
      if (StandardComponentState.pendingStartDot !== DotState.hoverDot) {
        const instance = new PlacedStandardComponent(
          StandardComponentState.armedDefinitionId,
          StandardComponentState.pendingStartDot,
          DotState.hoverDot
        );
        StandardComponentState.placedComponents.push(instance);
        StandardComponentState.selectedPlacedComponent = instance;
        HistoryState.changes.splice(HistoryState.changeIndex + 1);
        HistoryState.changes.push({type: 'add', kind: 'standard-component', component: instance});
        HistoryState.changeIndex++;
      }
      StandardComponentState.pendingStartDot = undefined;
      redrawCanvas();
      return;
    }

    // Placing a new Advanced (fixed-pin) Component from catalog: pins are rigid, so a
    // single click anchors the component using the current armed rotation, matching IC placement.
    // The exception is a gridSizable part (header pins), whose block size is chosen by the user:
    // that takes two clicks to span opposite corners, like a wire or a standard component.
    if (AdvancedComponentState.armedDefinitionId && DotState.hoverDot) {
      const armedDef = getAdvancedComponentDefinition(AdvancedComponentState.armedDefinitionId);
      if (armedDef?.gridSizable) {
        if (!AdvancedComponentState.pendingAnchorDot) {
          AdvancedComponentState.pendingAnchorDot = DotState.hoverDot;
          redrawCanvas();
          return;
        }
        const startDot = AdvancedComponentState.pendingAnchorDot;
        const endDot = DotState.hoverDot;
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
          const block = new PlacedAdvancedComponent(
            AdvancedComponentState.armedDefinitionId,
            anchorDot,
            0
          );
          block.rows = rows;
          block.cols = cols;
          AdvancedComponentState.placedComponents.push(block);
          AdvancedComponentState.selectedPlacedComponent = block;
          HistoryState.changes.splice(HistoryState.changeIndex + 1);
          HistoryState.changes.push({type: 'add', kind: 'advanced-component', component: block});
          HistoryState.changeIndex++;
        }
        // Stays armed for repeated placement, matching the standard component/wire flow.
        AdvancedComponentState.pendingAnchorDot = undefined;
        redrawCanvas();
        return;
      }
      const instance = new PlacedAdvancedComponent(
        AdvancedComponentState.armedDefinitionId,
        DotState.hoverDot,
        AdvancedComponentState.armedRotation
      );
      AdvancedComponentState.placedComponents.push(instance);
      AdvancedComponentState.selectedPlacedComponent = instance;
      HistoryState.changes.splice(HistoryState.changeIndex + 1);
      HistoryState.changes.push({type: 'add', kind: 'advanced-component', component: instance});
      HistoryState.changeIndex++;
      redrawCanvas();
      return;
    }

    // Placing a new Wire (two-click span, stays armed for repeated placement)
    if (ToolState.armedWire && DotState.hoverDot) {
      if (!ToolState.wireStartDot) {
        ToolState.wireStartDot = DotState.hoverDot;
        redrawCanvas();
        return;
      }
      if (ToolState.wireStartDot !== DotState.hoverDot) {
        const newLine: ILine = {
          start: ToolState.wireStartDot,
          end: DotState.hoverDot,
          color: ToolState.activeWireColor || "#3b82f6",
          width: ToolState.selectedWireWidth || 4
        };
        LineState.lines.push(newLine);
        HistoryState.changes.splice(HistoryState.changeIndex + 1);
        HistoryState.changes.push({type: 'add', kind: 'line', line: newLine});
        HistoryState.changeIndex++;
        DotState.selectedDot = undefined;
        LineState.selectedLine = newLine;
        // Chain the run: the end pad becomes the next wire's start, so a series of
        // connections costs one click per wire instead of two.
        ToolState.wireStartDot = DotState.hoverDot;
      } else {
        // Clicking the same pad again ends the run without drawing anything.
        ToolState.wireStartDot = undefined;
      }
      redrawCanvas();
      updateSelectionStatus();
      return;
    }

    // Skip IC/Standard Component select & drag while actively wiring, so a click on a pin/terminal
    // dot connects a wire there instead of being swallowed as "select the parent component."
    if (!ToolState.armedWire) {
      // Check hit on an existing placed IC on canvas (Enable Drag & Drop)
      const hitPlacedIc = IcState.placedIcs.find(ic => ic.containsPoint(x, y));
      if (hitPlacedIc) {
        IcState.selectedPlacedIc = hitPlacedIc;
        beginDrag({kind: "ic", ic: hitPlacedIc}, x, y);
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

      // Check hit on an existing placed Standard Component (Enable Drag & Drop)
      const hitPlacedComponent = StandardComponentState.placedComponents.find(c => c.containsPoint(x, y));
      if (hitPlacedComponent) {
        StandardComponentState.selectedPlacedComponent = hitPlacedComponent;
        beginDrag({kind: "standard-component", component: hitPlacedComponent}, x, y);
        DotState.selectedDot = undefined;
        LineState.selectedLine = undefined;
        redrawCanvas();
        return;
      }

      // Deselect placed Standard Component if clicking on empty space
      if (StandardComponentState.selectedPlacedComponent) {
        StandardComponentState.selectedPlacedComponent = undefined;
        redrawCanvas();
        // Fall through to normal dot/line selection
      }

      // Check hit on an existing placed Advanced Component (Enable Drag & Drop)
      const hitPlacedAdvancedComponent = AdvancedComponentState.placedComponents.find(c => c.containsPoint(x, y));
      if (hitPlacedAdvancedComponent) {
        AdvancedComponentState.selectedPlacedComponent = hitPlacedAdvancedComponent;
        beginDrag({kind: "advanced-component", component: hitPlacedAdvancedComponent}, x, y);
        DotState.selectedDot = undefined;
        LineState.selectedLine = undefined;
        redrawCanvas();
        return;
      }

      // Deselect placed Advanced Component if clicking on empty space
      if (AdvancedComponentState.selectedPlacedComponent) {
        AdvancedComponentState.selectedPlacedComponent = undefined;
        redrawCanvas();
        // Fall through to normal dot/line selection
      }
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
  endDrag();
});

// Right click context menu handler
Canvas.c.addEventListener('contextmenu', function(e) {
  e.preventDefault();

  const {x, y} = Canvas.toDrawingCoordinates(e);

  const hitComponent = StandardComponentState.placedComponents.find(c => c.containsPoint(x, y));
  if (hitComponent) {
    StandardComponentState.selectedPlacedComponent = hitComponent;
    DotState.selectedDot = undefined;
    LineState.selectedLine = undefined;
    redrawCanvas();
    showContextMenu(e.clientX, e.clientY);
    return;
  }

  const hitAdvancedComponent = AdvancedComponentState.placedComponents.find(c => c.containsPoint(x, y));
  if (hitAdvancedComponent) {
    AdvancedComponentState.selectedPlacedComponent = hitAdvancedComponent;
    DotState.selectedDot = undefined;
    LineState.selectedLine = undefined;
    redrawCanvas();
    showContextMenu(e.clientX, e.clientY);
    return;
  }

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
      HistoryState.changes.push({type: 'remove', kind: 'line', line: LineState.selectedLine});
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

  const {x, y} = Canvas.toDrawingCoordinates(event);

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
      // Clear stale component selections when selecting a wire
      IcState.selectedPlacedIc = undefined;
      StandardComponentState.selectedPlacedComponent = undefined;
      redrawCanvas();
      return;
    }
  }

  DotState.selectedDot = undefined;
  LineState.selectedLine = undefined;
  redrawCanvas();
}

function setSelection(event) {
  selectDot();
  selectLine(event);
}

ShortcutRegistry.add({key: "Escape", description: "Unselect dot or line", event: ()=>{
  // Mid-run, Escape only breaks the chain and leaves the wire tool armed, so ending a
  // run does not cost a re-arm. A second press falls through and disarms it.
  if (ToolState.armedWire && ToolState.wireStartDot) {
    ToolState.wireStartDot = undefined;
    updateSelectionStatus();
    redrawCanvas();
    return;
  }
  DotState.selectedDot = undefined;
  LineState.selectedLine = undefined;
  IcState.selectedIc = undefined;
  IcState.selectedPlacedIc = undefined;
  cancelDrag();
  StandardComponentState.armedDefinitionId = undefined;
  StandardComponentState.pendingStartDot = undefined;
  StandardComponentState.selectedPlacedComponent = undefined;
  AdvancedComponentState.armedDefinitionId = undefined;
  AdvancedComponentState.pendingAnchorDot = undefined;
  AdvancedComponentState.selectedPlacedComponent = undefined;
  disarmWire();
  hideContextMenu();
  updateSelectionStatus();
  redrawCanvas();
}});