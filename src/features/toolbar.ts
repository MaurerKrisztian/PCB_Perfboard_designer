import {ToolState} from "../state/ToolState";
import {SelectionState} from "../state/SelectionState";
import {redrawCanvas} from "./draw-canvas";
import {arm} from "./armed-tool";

// Tool Mode Selector Listener. The highlighted button follows ToolState (see updateSelectionStatus).
document.querySelectorAll('#toolModeSelector .tool-mode-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget as HTMLElement;
    const mode = target.getAttribute('data-mode') as 'select' | 'eraser' | 'note' | 'ic';
    if (mode) {
      ToolState.activeToolMode = mode;
      // Switching tool mode exits any armed wire/component/IC placement
      arm();
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
      if (SelectionState.line) {
        SelectionState.line.width = ToolState.selectedWireWidth;
        redrawCanvas();
      }
    }
  });
});
