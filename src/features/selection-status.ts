import {ArmedTool, ToolState} from "../state/ToolState";
import {SelectionState} from "../state/SelectionState";
import {updateStandardComponentButtonHighlight} from "./standard-components/standard-components-panel";
import {getComponentDefinition} from "./standard-components/component-definitions";
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

// Toolbar highlights follow the state rather than being toggled by each control: the wire button
// while the wire tool is armed, otherwise the active tool mode's button.
function syncToolHighlights() {
  const wireArmed = ToolState.armed?.kind === "wire";
  document.getElementById('wireArmBtn')?.classList.toggle('active-mode', wireArmed);
  document.querySelectorAll('#toolModeSelector .tool-mode-btn').forEach(btn => {
    btn.classList.toggle('active-mode', !wireArmed && btn.getAttribute('data-mode') === ToolState.activeToolMode);
  });
  updateStandardComponentButtonHighlight();
  updateAdvancedComponentButtonHighlight();
}

function armedStatusText(armed: ArmedTool): string {
  if (armed.kind === "wire") {
    return armed.start
      ? `Wiring Run [Click next pad • Same pad or Esc to end run]`
      : `Wire Tool Armed [Click start pad]`;
  }
  if (armed.kind === "standard-component") {
    const name = getComponentDefinition(armed.definitionId)?.name ?? "Component";
    return armed.start ? `Placing ${name} [Click end pad]` : `${name} Armed [Click start pad]`;
  }
  if (armed.kind === "advanced-component") {
    const def = getAdvancedComponentDefinition(armed.definitionId);
    const name = def?.name ?? "Component";
    if (def?.gridSizable) {
      return armed.start ? `Placing ${name} [Click opposite corner]` : `${name} Armed [Click first corner]`;
    }
    return `${name} Armed [Click pad to place • R to rotate]`;
  }
  return `IC Ready: ${armed.template.name} [Click Pad to Place]`;
}

export function updateSelectionStatus() {
  const statusEl = document.getElementById('activeSelectionStatus');
  syncToolHighlights();
  if (!statusEl) return;
  const modeLabel = ToolState.activeToolMode.toUpperCase();
  const selection = SelectionState.current;
  // A selected part outranks an armed tool, which outranks a selected wire or pad.
  if (selection?.kind === "part") {
    const part = selection.part;
    if (part.kind === "ic") {
      setStatus(statusEl, `Placed IC Selected (${part.name}) [Drag to Move • Del to Remove]`, SELECTED_PART_COLOR);
    } else if (part.kind === "advanced-component") {
      const def = part.getDefinition();
      const size = def?.gridSizable ? ` ${part.rows}×${part.cols}` : "";
      setStatus(statusEl, `${def?.name ?? "Component"}${size} Selected [Drag to Move • R to Rotate • Del to Remove]`, SELECTED_PART_COLOR);
    } else {
      const def = part.getDefinition();
      setStatus(statusEl, `${def?.name ?? "Component"} Selected [Drag to Move • Del to Remove]`, SELECTED_PART_COLOR);
    }
  } else if (ToolState.armed) {
    setStatus(statusEl, armedStatusText(ToolState.armed));
  } else if (selection?.kind === "line") {
    setStatus(statusEl, `Line Selected (${selection.line.width || 4}px) [Mode: ${modeLabel}]`, selection.line.color || '#777676');
  } else if (selection?.kind === "dot") {
    setStatus(statusEl, `Pad Selected (${selection.dot.x}, ${selection.dot.y}) [Mode: ${modeLabel}]`, selection.dot.color || '#a4a0a0');
  } else {
    setStatus(statusEl, `Tool: ${modeLabel} Mode`);
  }
}

// Update status badge on user clicks
window.addEventListener('click', () => {
  setTimeout(updateSelectionStatus, 50);
});
