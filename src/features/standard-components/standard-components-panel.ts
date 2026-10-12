import {Utils} from "../../utils/utils";
import {ToolState} from "../../state/ToolState";
import {setActiveTool} from "../active-tool";
import {COMPONENT_DEFINITIONS, getIconPath} from "./component-definitions";

export function armStandardComponent(definitionId: string) {
  const active = ToolState.active;
  // Clicking the already-armed component again disarms it
  setActiveTool(active.kind === "standard-component" && active.definitionId === definitionId
    ? {kind: "select"}
    : {kind: "standard-component", definitionId});
}

export function updateStandardComponentButtonHighlight() {
  const container = document.getElementById("standard-components-items");
  if (!container) return;
  container.querySelectorAll<HTMLButtonElement>("button[data-def-id]").forEach((btn) => {
    const active = ToolState.active;
    btn.classList.toggle("active-mode", active.kind === "standard-component" && btn.dataset.defId === active.definitionId);
  });
}

export function renderStandardComponentsPanel() {
  const container = Utils.getSafeHtmlElement("standard-components-items");
  container.innerHTML = "";
  for (const def of COMPONENT_DEFINITIONS) {
    const btn = document.createElement("button");
    btn.className = "btn btn-accent";
    btn.style.cssText = "padding:0.3rem 0.6rem; font-size:0.75rem;";
    btn.dataset.defId = def.id;

    const icon = document.createElement("img");
    icon.src = getIconPath(def);
    icon.alt = "";
    icon.style.cssText = "width:22px;height:14px;object-fit:contain;vertical-align:middle;margin-right:4px;";
    icon.onerror = () => { icon.style.display = "none"; };
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(def.name));

    btn.addEventListener("click", () => armStandardComponent(def.id));
    container.appendChild(btn);
  }
}

renderStandardComponentsPanel();
