import {ToolState} from "../state/ToolState";
import {LineState} from "../state/LineState";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {IcState} from "../state/IcState";
import {redrawCanvas} from "./draw-canvas";
import {updateSelectionStatus} from "./selection-status";
import {disarmWire} from "./wire";

// Tool Mode Selector Listener
document.querySelectorAll('#toolModeSelector .tool-mode-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#toolModeSelector .tool-mode-btn').forEach(b => b.classList.remove('active-mode'));
    const target = e.currentTarget as HTMLElement;
    target.classList.add('active-mode');
    const mode = target.getAttribute('data-mode') as 'select' | 'eraser' | 'note' | 'ic';
    if (mode) {
      ToolState.activeToolMode = mode;
      // Switching tool mode exits any armed wire/component/IC placement
      disarmWire();
      StandardComponentState.armedDefinitionId = undefined;
      StandardComponentState.pendingStartDot = undefined;
      AdvancedComponentState.armedDefinitionId = undefined;
      AdvancedComponentState.pendingAnchorDot = undefined;
      IcState.selectedIc = undefined;
      updateSelectionStatus();
      redrawCanvas();
    }
  });
});

// Wire Gauge Selector Listener
document.querySelectorAll('#wireGaugeSelector .gauge-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#wireGaugeSelector .gauge-btn').forEach(b => b.classList.remove('active-mode'));
    const target = e.currentTarget as HTMLElement;
    target.classList.add('active-mode');
    const widthStr = target.getAttribute('data-width');
    if (widthStr) {
      ToolState.selectedWireWidth = parseInt(widthStr);
      if (LineState.selectedLine) {
        LineState.selectedLine.width = ToolState.selectedWireWidth;
        redrawCanvas();
      }
    }
  });
});
