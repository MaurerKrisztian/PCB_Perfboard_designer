import {ToolState} from "../state/ToolState";
import {IcState} from "../state/IcState";
import {LineState} from "../state/LineState";
import {DotState} from "../state/DotState";
import {StandardComponentState} from "../state/StandardComponentState";
import {updateStandardComponentButtonHighlight} from "./standard-components/standard-components-panel";
import {getComponentDefinition} from "./standard-components/component-definitions";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {updateAdvancedComponentButtonHighlight} from "./advanced-components/advanced-components-panel";
import {getAdvancedComponentDefinition} from "./advanced-components/advanced-component-definitions";

export function updateSelectionStatus() {
  const statusEl = document.getElementById('activeSelectionStatus');
  updateStandardComponentButtonHighlight();
  updateAdvancedComponentButtonHighlight();
  if (!statusEl) return;
  const modeLabel = ToolState.activeToolMode.toUpperCase();
  if (IcState.selectedPlacedIc) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:4px;"></span> Placed IC Selected (${IcState.selectedPlacedIc.name}) [Drag to Move • Del to Remove]`;
  } else if (AdvancedComponentState.selectedPlacedComponent) {
    const selected = AdvancedComponentState.selectedPlacedComponent;
    const def = selected.getDefinition();
    const size = def?.gridSizable ? ` ${selected.rows}×${selected.cols}` : "";
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:4px;"></span> ${def?.name ?? "Component"}${size} Selected [Drag to Move • R to Rotate • Del to Remove]`;
  } else if (StandardComponentState.selectedPlacedComponent) {
    const def = StandardComponentState.selectedPlacedComponent.getDefinition();
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#38bdf8;margin-right:4px;"></span> ${def?.name ?? "Component"} Selected [Drag to Move • Del to Remove]`;
  } else if (ToolState.armedWire) {
    statusEl.innerHTML = ToolState.wireStartDot
      ? `<span>Wiring Run [Click next pad • Same pad or Esc to end run]</span>`
      : `<span>Wire Tool Armed [Click start pad]</span>`;
  } else if (StandardComponentState.armedDefinitionId) {
    const def = getComponentDefinition(StandardComponentState.armedDefinitionId);
    const name = def?.name ?? "Component";
    statusEl.innerHTML = StandardComponentState.pendingStartDot
      ? `<span>Placing ${name} [Click end pad]</span>`
      : `<span>${name} Armed [Click start pad]</span>`;
  } else if (AdvancedComponentState.armedDefinitionId) {
    const def = getAdvancedComponentDefinition(AdvancedComponentState.armedDefinitionId);
    const name = def?.name ?? "Component";
    if (def?.gridSizable) {
      statusEl.innerHTML = AdvancedComponentState.pendingAnchorDot
        ? `<span>Placing ${name} [Click opposite corner]</span>`
        : `<span>${name} Armed [Click first corner]</span>`;
    } else {
      statusEl.innerHTML = `<span>${name} Armed [Click pad to place • R to rotate]</span>`;
    }
  } else if (IcState.selectedIc) {
    statusEl.innerHTML = `<span>IC Ready: ${IcState.selectedIc.name} [Click Pad to Place]</span>`;
  } else if (LineState.selectedLine) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${LineState.selectedLine.color || '#777676'};margin-right:4px;"></span> Line Selected (${LineState.selectedLine.width || 4}px) [Mode: ${modeLabel}]`;
  } else if (DotState.selectedDot) {
    statusEl.innerHTML = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${DotState.selectedDot.color || '#a4a0a0'};margin-right:4px;"></span> Pad Selected (${DotState.selectedDot.x}, ${DotState.selectedDot.y}) [Mode: ${modeLabel}]`;
  } else {
    statusEl.innerHTML = `<span>Tool: ${modeLabel} Mode</span>`;
  }
}

// Update status badge on user clicks
window.addEventListener('click', () => {
  setTimeout(updateSelectionStatus, 50);
});
