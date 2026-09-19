import {ToolState} from "../state/ToolState";
import {IcState} from "../state/IcState";
import {LineState} from "../state/LineState";
import {DotState} from "../state/DotState";

export function updateSelectionStatus() {
  const statusEl = document.getElementById('activeSelectionStatus');
  if (!statusEl) return;
  const modeLabel = ToolState.activeToolMode.toUpperCase();
  if (IcState.selectedPlacedIc) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:4px;"></span> Placed IC Selected (${IcState.selectedPlacedIc.name}) [Click Pad to Relocate • Del to Remove]`;
  } else if (LineState.selectedLine) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${LineState.selectedLine.color || '#777676'};margin-right:4px;"></span> Line Selected (${LineState.selectedLine.width || 4}px) [Mode: ${modeLabel}]`;
  } else if (DotState.selectedDot) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${DotState.selectedDot.color || '#a4a0a0'};margin-right:4px;"></span> Pad Selected (${DotState.selectedDot.x}, ${DotState.selectedDot.y}) [Mode: ${modeLabel}]`;
  } else if (IcState.selectedIc) {
    statusEl.innerHTML = `<span>IC Ready: ${IcState.selectedIc.name} [Click Pad to Place]</span>`;
  } else {
    statusEl.innerHTML = `<span>Tool: ${modeLabel} Mode</span>`;
  }
}

// Update status badge on user clicks
window.addEventListener('click', () => {
  setTimeout(updateSelectionStatus, 50);
});
