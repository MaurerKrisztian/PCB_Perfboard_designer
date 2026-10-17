import {redrawCanvas} from "./draw-canvas";
import {rotateSelectedIc} from "./ic";
import {hideContextMenu, hideLedColorMenu, showLedColorMenu} from "./select";
import {changeSelectedDotColor} from "./dot";
import {addDescriptionToDot} from "./dot-notes";
import {deleteLine} from "./line";
import {setSelectedComponentValue, setSelectedLedColor} from "./standard-components/standard-component-actions";
import type {LedColor} from "./standard-components/standard-component-actions";
import {SelectionState} from "../state/SelectionState";
import {isLed} from "../parts/component-definitions";

// Context Menu item handlers
document.getElementById('ctxRotateBtn')?.addEventListener('click', () => {
  rotateSelectedIc();
  hideContextMenu();
});

document.getElementById('ctxColorBtn')?.addEventListener('click', () => {
  const part = SelectionState.part;
  if (part?.kind === "standard-component" && isLed(part.definitionId)) {
    showLedColorMenu();
    return;
  }
  hideContextMenu();
  if (SelectionState.line || SelectionState.dot) {
    changeSelectedDotColor();
  }
});

document.querySelectorAll<HTMLButtonElement>('#ledColorMenu button[data-led-color]').forEach(btn => {
  btn.addEventListener('click', () => {
    const color = btn.dataset.ledColor as LedColor | "";
    setSelectedLedColor(color ? color : undefined);
    hideLedColorMenu();
  });
});

document.getElementById('ctxNoteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (SelectionState.dot) {
    if (addDescriptionToDot()) redrawCanvas();
  }
});

document.getElementById('ctxValueBtn')?.addEventListener('click', () => {
  hideContextMenu();
  setSelectedComponentValue();
});

document.getElementById('ctxDeleteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (SelectionState.line || SelectionState.part) {
    deleteLine();
  } else if (SelectionState.dot && SelectionState.dot.description) {
    SelectionState.dot.description = undefined;
    redrawCanvas();
  }
});
