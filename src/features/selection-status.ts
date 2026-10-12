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

const SWATCH_STYLE = "display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;";
const SELECTED_PART_COLOR = "#38bdf8";

// Built with DOM calls rather than innerHTML: IC names and wire/pad colors come from project
// files, so they must never be parsed as markup.
function setStatus(statusEl: HTMLElement, text: string, swatchColor?: string) {
  if (!swatchColor) {
    const label = document.createElement("span");
    label.textContent = text;
    statusEl.replaceChildren(label);
    return;
  }
  const swatch = document.createElement("span");
  swatch.style.cssText = SWATCH_STYLE;
  swatch.style.background = swatchColor;
  statusEl.replaceChildren(swatch, document.createTextNode(` ${text}`));
}

export function updateSelectionStatus() {
  const statusEl = document.getElementById('activeSelectionStatus');
  updateStandardComponentButtonHighlight();
  updateAdvancedComponentButtonHighlight();
  if (!statusEl) return;
  const modeLabel = ToolState.activeToolMode.toUpperCase();
  if (IcState.selectedPlacedIc) {
    setStatus(statusEl, `Placed IC Selected (${IcState.selectedPlacedIc.name}) [Drag to Move • Del to Remove]`, SELECTED_PART_COLOR);
  } else if (AdvancedComponentState.selectedPlacedComponent) {
    const selected = AdvancedComponentState.selectedPlacedComponent;
    const def = selected.getDefinition();
    const size = def?.gridSizable ? ` ${selected.rows}×${selected.cols}` : "";
    setStatus(statusEl, `${def?.name ?? "Component"}${size} Selected [Drag to Move • R to Rotate • Del to Remove]`, SELECTED_PART_COLOR);
  } else if (StandardComponentState.selectedPlacedComponent) {
    const def = StandardComponentState.selectedPlacedComponent.getDefinition();
    setStatus(statusEl, `${def?.name ?? "Component"} Selected [Drag to Move • Del to Remove]`, SELECTED_PART_COLOR);
  } else if (ToolState.armedWire) {
    setStatus(statusEl, ToolState.wireStartDot
      ? `Wiring Run [Click next pad • Same pad or Esc to end run]`
      : `Wire Tool Armed [Click start pad]`);
  } else if (StandardComponentState.armedDefinitionId) {
    const def = getComponentDefinition(StandardComponentState.armedDefinitionId);
    const name = def?.name ?? "Component";
    setStatus(statusEl, StandardComponentState.pendingStartDot
      ? `Placing ${name} [Click end pad]`
      : `${name} Armed [Click start pad]`);
  } else if (AdvancedComponentState.armedDefinitionId) {
    const def = getAdvancedComponentDefinition(AdvancedComponentState.armedDefinitionId);
    const name = def?.name ?? "Component";
    if (def?.gridSizable) {
      setStatus(statusEl, AdvancedComponentState.pendingAnchorDot
        ? `Placing ${name} [Click opposite corner]`
        : `${name} Armed [Click first corner]`);
    } else {
      setStatus(statusEl, `${name} Armed [Click pad to place • R to rotate]`);
    }
  } else if (IcState.selectedIc) {
    setStatus(statusEl, `IC Ready: ${IcState.selectedIc.name} [Click Pad to Place]`);
  } else if (LineState.selectedLine) {
    setStatus(statusEl, `Line Selected (${LineState.selectedLine.width || 4}px) [Mode: ${modeLabel}]`, LineState.selectedLine.color || '#777676');
  } else if (DotState.selectedDot) {
    setStatus(statusEl, `Pad Selected (${DotState.selectedDot.x}, ${DotState.selectedDot.y}) [Mode: ${modeLabel}]`, DotState.selectedDot.color || '#a4a0a0');
  } else {
    setStatus(statusEl, `Tool: ${modeLabel} Mode`);
  }
}

// Update status badge on user clicks
window.addEventListener('click', () => {
  setTimeout(updateSelectionStatus, 50);
});
