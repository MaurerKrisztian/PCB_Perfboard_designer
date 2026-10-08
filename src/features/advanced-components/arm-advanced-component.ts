import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {IcState} from "../../state/IcState";
import {StandardComponentState} from "../../state/StandardComponentState";
import {redrawCanvas} from "../draw-canvas";
import {disarmWire} from "../wire";
import {notifyArmedPartChanged} from "../catalog/catalog-events";

export function armAdvancedComponent(definitionId: string) {
  if (AdvancedComponentState.armedDefinitionId === definitionId) {
    // Clicking the already-armed component again disarms it
    AdvancedComponentState.armedDefinitionId = undefined;
    AdvancedComponentState.pendingAnchorDot = undefined;
    notifyArmedPartChanged();
    redrawCanvas();
    return;
  }
  AdvancedComponentState.armedDefinitionId = definitionId;
  AdvancedComponentState.armedRotation = 0;
  AdvancedComponentState.pendingAnchorDot = undefined;
  StandardComponentState.armedDefinitionId = undefined;
  StandardComponentState.pendingStartDot = undefined;
  IcState.selectedIc = undefined;
  disarmWire();
  notifyArmedPartChanged();
  redrawCanvas();
}
