import {ToolState} from "../state/ToolState";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {IcState} from "../state/IcState";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";
import {updateSelectionStatus} from "./selection-status";
import {ShortcutRegistry} from "./shortcut-keys";

export function disarmWire() {
  ToolState.armedWire = false;
  ToolState.wireStartDot = undefined;
  document.getElementById('wireArmBtn')?.classList.remove('active-mode');
}

export function armWire() {
  ToolState.armedWire = true;
  ToolState.wireStartDot = undefined;
  StandardComponentState.armedDefinitionId = undefined;
  StandardComponentState.pendingStartDot = undefined;
  AdvancedComponentState.armedDefinitionId = undefined;
  AdvancedComponentState.pendingAnchorDot = undefined;
  IcState.selectedIc = undefined;
  Utils.getSafeHtmlElement('wireArmBtn').classList.add('active-mode');
  redrawCanvas();
  updateSelectionStatus();
}

Utils.getSafeHtmlElement<HTMLButtonElement>('wireArmBtn').addEventListener('click', () => {
  if (ToolState.armedWire) {
    disarmWire();
    redrawCanvas();
    updateSelectionStatus();
  } else {
    armWire();
  }
});

ShortcutRegistry.add({
  key: "w",
  description: "Toggle wire tool.",
  event: () => {
    if (ToolState.armedWire) {
      disarmWire();
      redrawCanvas();
      updateSelectionStatus();
    } else {
      armWire();
    }
  }
});
