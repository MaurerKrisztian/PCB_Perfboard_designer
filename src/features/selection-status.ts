import {State} from "../state/State";

export function updateSelectionStatus() {
  const statusEl = document.getElementById('activeSelectionStatus');
  if (!statusEl) return;
  const modeLabel = State.activeToolMode.toUpperCase();
  if (State.selectedPlacedIc) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:4px;"></span> Placed IC Selected (${State.selectedPlacedIc.name}) [Click Pad to Relocate • Del to Remove]`;
  } else if (State.selectedLine) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${State.selectedLine.color || '#777676'};margin-right:4px;"></span> Line Selected (${State.selectedLine.width || 4}px) [Mode: ${modeLabel}]`;
  } else if (State.selectedDot) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${State.selectedDot.color || '#a4a0a0'};margin-right:4px;"></span> Pad Selected (${State.selectedDot.x}, ${State.selectedDot.y}) [Mode: ${modeLabel}]`;
  } else if (State.selectedIc) {
    statusEl.innerHTML = `<span>IC Ready: ${State.selectedIc.name} [Click Pad to Place]</span>`;
  } else {
    statusEl.innerHTML = `<span>Tool: ${modeLabel} Mode</span>`;
  }
}

// Update status badge on user clicks
window.addEventListener('click', () => {
  setTimeout(updateSelectionStatus, 50);
});
