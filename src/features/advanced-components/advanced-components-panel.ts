import {Utils} from "../../utils/utils";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {IcState} from "../../state/IcState";
import {StandardComponentState} from "../../state/StandardComponentState";
import {redrawCanvas} from "../draw-canvas";
import {disarmWire} from "../wire";
import {ADVANCED_COMPONENT_DEFINITIONS, getAdvancedIconPath} from "./advanced-component-definitions";

export function armAdvancedComponent(definitionId: string) {
  if (AdvancedComponentState.armedDefinitionId === definitionId) {
    // Clicking the already-armed component again disarms it
    AdvancedComponentState.armedDefinitionId = undefined;
    AdvancedComponentState.pendingAnchorDot = undefined;
    updateAdvancedComponentButtonHighlight();
    redrawCanvas();
    return;
  }
  AdvancedComponentState.armedDefinitionId = definitionId;
  AdvancedComponentState.armedRotation = 0;
  AdvancedComponentState.pendingAnchorDot = undefined;
  StandardComponentState.armedDefinitionId = undefined;
  StandardComponentState.pendingStartDot = undefined;
  IcState.selectedIc = undefined;
  disarmWire();
  updateAdvancedComponentButtonHighlight();
  redrawCanvas();
}

export function updateAdvancedComponentButtonHighlight() {
  const container = document.getElementById("advanced-components-items");
  if (!container) return;
  container.querySelectorAll<HTMLButtonElement>("button[data-def-id]").forEach((btn) => {
    btn.classList.toggle("active-mode", btn.dataset.defId === AdvancedComponentState.armedDefinitionId);
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
