import {Utils} from "../../utils/utils";
import {StandardComponentState} from "../../state/StandardComponentState";
import {IcState} from "../../state/IcState";
import {redrawCanvas} from "../draw-canvas";
import {COMPONENT_DEFINITIONS, getIconPath} from "./component-definitions";

export function armStandardComponent(definitionId: string) {
  StandardComponentState.armedDefinitionId = definitionId;
  StandardComponentState.pendingStartDot = undefined;
  IcState.selectedIc = undefined;
  redrawCanvas();
}

export function renderStandardComponentsPanel() {
  const container = Utils.getSafeHtmlElement("standard-components-items");
  container.innerHTML = "";
  for (const def of COMPONENT_DEFINITIONS) {
    const btn = document.createElement("button");
    btn.className = "btn btn-accent";
    btn.style.cssText = "padding:0.3rem 0.6rem; font-size:0.75rem;";

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
