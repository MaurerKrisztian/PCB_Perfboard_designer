import {LineState} from "../state/LineState";
import {DotState} from "../state/DotState";
import {IcState} from "../state/IcState";
import {StandardComponentState} from "../state/StandardComponentState";
import {redrawCanvas} from "./draw-canvas";
import {rotateSelectedIc} from "./ic";
import {hideContextMenu} from "./select";
import {changeSelectedDotColor} from "./dot";
import {addDescriptionToDot} from "./description";
import {deleteLine} from "./line";
import {setSelectedComponentValue} from "./standard-components/standard-component-actions";

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

document.getElementById('ctxValueBtn')?.addEventListener('click', () => {
  hideContextMenu();
  setSelectedComponentValue();
});

document.getElementById('ctxDeleteBtn')?.addEventListener('click', () => {
  hideContextMenu();
  if (LineState.selectedLine || IcState.selectedPlacedIc || StandardComponentState.selectedPlacedComponent) {
    deleteLine();
  } else if (DotState.selectedDot && DotState.selectedDot.description) {
    DotState.selectedDot.description = undefined;
    redrawCanvas();
  }
});
