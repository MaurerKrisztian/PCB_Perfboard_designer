import {LineState} from "../state/LineState";
import {DotState} from "../state/DotState";
import {PartState} from "../state/PartState";
import {redrawCanvas} from "./draw-canvas";
import {rotateSelectedIc} from "./ic";
import {hideContextMenu, hideLedColorMenu, showLedColorMenu} from "./select";
import {changeSelectedDotColor} from "./dot";
import {addDescriptionToDot} from "./description";
import {deleteLine} from "./line";
import {setSelectedComponentValue, setSelectedLedColor} from "./standard-components/standard-component-actions";
import type {LedColor} from "./standard-components/standard-component-actions";

// Context Menu item handlers
document.getElementById('ctxRotateBtn')?.addEventListener('click', () => {
  rotateSelectedIc();
  hideContextMenu();
});

document.getElementById('ctxColorBtn')?.addEventListener('click', () => {
  const part = PartState.selected;
  if (part?.kind === "standard-component" && part.definitionId === "led") {
    showLedColorMenu();
    return;
  }
  hideContextMenu();
  if (LineState.selectedLine || DotState.selectedDot) {
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
  if (DotState.selectedDot) {
    addDescriptionToDot();
  }
});

document.getElementById('ctxValueBtn')?.addEventListener('click', () => {
  hideContextMenu();
  setSelectedComponentValue();
});

document.getElementById('ctxDeleteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (LineState.selectedLine || PartState.selected) {
    deleteLine();
  } else if (DotState.selectedDot && DotState.selectedDot.description) {
    DotState.selectedDot.description = undefined;
    redrawCanvas();
  }
});
