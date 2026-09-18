import {ToolState} from "../state/ToolState";
import {LineState} from "../state/LineState";
import {redrawCanvas} from "./draw-canvas";
import {updateSelectionStatus} from "./selection-status";

// Tool Mode Selector Listener
document.querySelectorAll('#toolModeSelector .tool-mode-btn').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('#toolModeSelector .tool-mode-btn').forEach(b => b.classList.remove('active-mode'));
    const target = e.currentTarget as HTMLElement;
    target.classList.add('active-mode');
    const mode = target.getAttribute('data-mode') as 'wire' | 'eraser' | 'note' | 'ic';
    if (mode) {
      ToolState.activeToolMode = mode;
      updateSelectionStatus();
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
