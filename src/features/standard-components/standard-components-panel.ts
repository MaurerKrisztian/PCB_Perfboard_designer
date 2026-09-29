import {Utils} from "../../utils/utils";
import {StandardComponentState} from "../../state/StandardComponentState";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {IcState} from "../../state/IcState";
import {redrawCanvas} from "../draw-canvas";
import {disarmWire} from "../wire";
import {COMPONENT_DEFINITIONS, getIconPath} from "./component-definitions";

export function armStandardComponent(definitionId: string) {
  if (StandardComponentState.armedDefinitionId === definitionId) {
    // Clicking the already-armed component again disarms it
    StandardComponentState.armedDefinitionId = undefined;
    StandardComponentState.pendingStartDot = undefined;
    updateStandardComponentButtonHighlight();
    redrawCanvas();
    return;
  }
  StandardComponentState.armedDefinitionId = definitionId;
  StandardComponentState.pendingStartDot = undefined;
  AdvancedComponentState.armedDefinitionId = undefined;
  AdvancedComponentState.pendingAnchorDot = undefined;
  IcState.selectedIc = undefined;
  disarmWire();
  updateStandardComponentButtonHighlight();
  redrawCanvas();
}

export function updateStandardComponentButtonHighlight() {
  const container = document.getElementById("standard-components-items");
  if (!container) return;
  container.querySelectorAll<HTMLButtonElement>("button[data-def-id]").forEach((btn) => {
    btn.classList.toggle("active-mode", btn.dataset.defId === StandardComponentState.armedDefinitionId);
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
