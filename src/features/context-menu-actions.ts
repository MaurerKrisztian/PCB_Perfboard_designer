import {LineState} from "../state/LineState";
import {DotState} from "../state/DotState";
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
  if (LineState.selectedLine || DotState.selectedDot) {
    changeSelectedDotColor();
  }
});

document.getElementById('ctxNoteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (DotState.selectedDot) {
    addDescriptionToDot();
  }
});

document.getElementById('ctxDeleteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (LineState.selectedLine) {
    deleteLine();
  } else if (DotState.selectedDot && DotState.selectedDot.description) {
    DotState.selectedDot.description = undefined;
    redrawCanvas();
  }
});
