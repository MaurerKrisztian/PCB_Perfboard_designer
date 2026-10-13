import {isPlacementTool, ToolState} from "../state/ToolState";
import {SelectionState} from "../state/SelectionState";
import {notifyArmedPartChanged} from "./catalog/catalog-events";
import {behaviorOf} from "./tools";

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

// Toolbar highlights follow the active tool rather than being toggled by each control: the mode
// button for a mode, the wire button for the wire tool, the catalog entry for an armed part.
function syncToolHighlights() {
  const kind = ToolState.active.kind;
  document.getElementById('wireArmBtn')?.classList.toggle('active-mode', kind === "wire");
  document.querySelectorAll('#toolModeSelector .tool-mode-btn').forEach(btn => {
    btn.classList.toggle('active-mode', btn.getAttribute('data-mode') === kind);
  });
  notifyArmedPartChanged();
}

export function updateSelectionStatus() {
  const statusEl = document.getElementById('activeSelectionStatus');
  syncToolHighlights();
  if (!statusEl) return;
  const tool = ToolState.active;
  const toolText = behaviorOf(tool).statusText(tool);
  const modeLabel = tool.kind.toUpperCase();
  const selection = SelectionState.current;
  // A selected part outranks a placement tool, which outranks a selected wire or pad.
  if (selection?.kind === "part") {
    const part = selection.part;
    if (part.kind === "ic") {
      setStatus(statusEl, `${part.ref} ${part.name} Selected [Drag to Move • Del to Remove]`, SELECTED_PART_COLOR);
    } else if (part.kind === "advanced-component") {
      const def = part.getDefinition();
      const size = def?.gridSizable ? ` ${part.rows}×${part.cols}` : "";
      setStatus(statusEl, `${part.ref} ${def?.name ?? "Component"}${size} Selected [Drag to Move • R to Rotate • Del to Remove]`, SELECTED_PART_COLOR);
    } else {
      const def = part.getDefinition();
      setStatus(statusEl, `${part.ref} ${def?.name ?? "Component"} Selected [Drag to Move • Del to Remove]`, SELECTED_PART_COLOR);
    }
  } else if (isPlacementTool(tool)) {
    setStatus(statusEl, toolText);
  } else if (selection?.kind === "line") {
    setStatus(statusEl, `Line Selected (${selection.line.width || 4}px) [Mode: ${modeLabel}]`, selection.line.color || '#777676');
  } else if (selection?.kind === "dot") {
    setStatus(statusEl, `Pad Selected (${selection.dot.x}, ${selection.dot.y}) [Mode: ${modeLabel}]`, selection.dot.color || '#a4a0a0');
  } else {
    setStatus(statusEl, toolText);
  }
}

// Update status badge on user clicks
window.addEventListener('click', () => {
  setTimeout(updateSelectionStatus, 50);
});
