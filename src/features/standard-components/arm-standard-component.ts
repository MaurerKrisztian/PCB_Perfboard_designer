import {StandardComponentState} from "../../state/StandardComponentState";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {IcState} from "../../state/IcState";
import {redrawCanvas} from "../draw-canvas";
import {disarmWire} from "../wire";
import {notifyArmedPartChanged} from "../catalog/catalog-events";

export function armStandardComponent(definitionId: string) {
  if (StandardComponentState.armedDefinitionId === definitionId) {
    // Clicking the already-armed component again disarms it
    StandardComponentState.armedDefinitionId = undefined;
    StandardComponentState.pendingStartDot = undefined;
    notifyArmedPartChanged();
    redrawCanvas();
    return;
  }
  StandardComponentState.armedDefinitionId = definitionId;
  StandardComponentState.pendingStartDot = undefined;
  AdvancedComponentState.armedDefinitionId = undefined;
  AdvancedComponentState.pendingAnchorDot = undefined;
  IcState.selectedIc = undefined;
  disarmWire();
  notifyArmedPartChanged();
  redrawCanvas();
}
