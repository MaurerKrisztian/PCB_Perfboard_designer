import {Utils} from "../../utils/utils";
import {ToolState} from "../../state/ToolState";
import {setActiveTool} from "../active-tool";
import {ADVANCED_COMPONENT_DEFINITIONS, getAdvancedIconPath} from "./advanced-component-definitions";

export function armAdvancedComponent(definitionId: string) {
  const active = ToolState.active;
  // Clicking the already-armed component again disarms it
  setActiveTool(active.kind === "advanced-component" && active.definitionId === definitionId
    ? {kind: "select"}
    : {kind: "advanced-component", definitionId, rotation: 0});
}

export function updateAdvancedComponentButtonHighlight() {
  const container = document.getElementById("advanced-components-items");
  if (!container) return;
  container.querySelectorAll<HTMLButtonElement>("button[data-def-id]").forEach((btn) => {
    const active = ToolState.active;
    btn.classList.toggle("active-mode", active.kind === "advanced-component" && btn.dataset.defId === active.definitionId);
  });
}

export function renderAdvancedComponentsPanel() {
  const container = Utils.getSafeHtmlElement("advanced-components-items");
  container.innerHTML = "";
  for (const def of ADVANCED_COMPONENT_DEFINITIONS) {
    const btn = document.createElement("button");
    btn.className = "btn btn-accent";
    btn.style.cssText = "padding:0.3rem 0.6rem; font-size:0.75rem;";
    btn.dataset.defId = def.id;

    const icon = document.createElement("img");
    icon.src = getAdvancedIconPath(def);
    icon.alt = "";
    icon.style.cssText = "width:22px;height:14px;object-fit:contain;vertical-align:middle;margin-right:4px;";
    icon.onerror = () => { icon.style.display = "none"; };
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(def.name));

    btn.addEventListener("click", () => armAdvancedComponent(def.id));
    container.appendChild(btn);
  }
}

renderAdvancedComponentsPanel();
