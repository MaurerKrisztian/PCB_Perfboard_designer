import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {rotateSelectedIc} from "./ic";
import {hideContextMenu} from "./select";
import {changeSelectedDotColor} from "./dot";
import {addDescriptionToDot} from "./description";
import {deleteLine} from "./line";

// Context Menu item handlers
document.getElementById('ctxRotateBtn')?.addEventListener('click', () => {
  rotateSelectedIc();
  hideContextMenu();
});

document.getElementById('ctxColorBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (State.selectedLine || State.selectedDot) {
    changeSelectedDotColor();
  }
});

document.getElementById('ctxNoteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (State.selectedDot) {
    addDescriptionToDot();
  }
});

document.getElementById('ctxDeleteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (State.selectedLine) {
    deleteLine();
  } else if (State.selectedDot && State.selectedDot.description) {
    State.selectedDot.description = undefined;
    redrawCanvas();
  }
});
