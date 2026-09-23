import {StandardComponentState} from "../../state/StandardComponentState";
import {redrawCanvas} from "../draw-canvas";

export function setSelectedComponentValue() {
  const component = StandardComponentState.selectedPlacedComponent;
  if (!component) {
    alert("Please select a component first by clicking on it.");
    return;
  }
  const value = prompt("Enter a value for this component (e.g. 220Ω, 10µF):", component.value || "");
  if (value !== null) {
    component.value = value.trim() ? value.trim() : undefined;
    redrawCanvas();
  }
}
