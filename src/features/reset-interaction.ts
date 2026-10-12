import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {IcState} from "../state/IcState";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {HistoryState} from "../state/HistoryState";
import {cancelDrag} from "./component-drag";
import {clearPartSelection} from "./placed-parts";
import {disarmWire} from "./wire";
import {updateSelectionStatus} from "./selection-status";

// Drops the selection, any armed placement (wire, IC, component) and a drag in progress.
export function resetInteraction() {
  cancelDrag();
  DotState.selectedDot = undefined;
  LineState.selectedLine = undefined;
  clearPartSelection();
  IcState.selectedIc = undefined;
  StandardComponentState.armedDefinitionId = undefined;
  StandardComponentState.pendingStartDot = undefined;
  AdvancedComponentState.armedDefinitionId = undefined;
  AdvancedComponentState.pendingAnchorDot = undefined;
  disarmWire();
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
