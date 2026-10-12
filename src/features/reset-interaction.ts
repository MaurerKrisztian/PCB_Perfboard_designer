import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {HistoryState} from "../state/HistoryState";
import {SelectionState} from "../state/SelectionState";
import {ToolState} from "../state/ToolState";
import {cancelDrag} from "./component-drag";
import {updateSelectionStatus} from "./selection-status";

// Drops the selection, any armed placement (wire, IC, component) and a drag in progress.
export function resetInteraction() {
  cancelDrag();
  SelectionState.clear();
  ToolState.armed = undefined;
  updateSelectionStatus();
}

// Everything that refers to the board being replaced (load, reset, resize): the interaction
// state above, hover targets, and the undo history.
export function resetForNewBoard() {
  resetInteraction();
  DotState.hoverDot = undefined;
  LineState.hoverLine = undefined;
  HistoryState.clear();
}
