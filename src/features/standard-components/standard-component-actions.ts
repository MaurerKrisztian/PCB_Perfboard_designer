import {StandardComponentState} from "../../state/StandardComponentState";
import {AdvancedComponentState} from "../../state/AdvancedComponentState";
import {redrawCanvas} from "../draw-canvas";
import {ComponentUnit} from "./component-definitions";
import {formatComponentValue, parseComponentValue} from "./component-value";

const VALUE_EXAMPLES: Record<ComponentUnit, string> = {
  "Ω": "e.g. 220, 4.7k, 1M",
  "F": "e.g. 100pF, 10uF, 0.1uF",
  "H": "e.g. 100nH, 10uH, 1mH",
};

export const LED_COLORS = ["red", "green", "blue", "yellow", "rgb"] as const;
export type LedColor = typeof LED_COLORS[number];
const LED_COLOR_LABELS: Record<LedColor, string> = {
  red: "Red", green: "Green", blue: "Blue", yellow: "Yellow", rgb: "RGB"
};

export function setSelectedLedColor(color: LedColor | undefined) {
  const component = StandardComponentState.selectedPlacedComponent;
  if (!component || component.definitionId !== "led") return;
  component.color = color;
  component.value = color ? LED_COLOR_LABELS[color] : undefined;
  redrawCanvas();
}

export function setSelectedComponentValue() {
  const component = StandardComponentState.selectedPlacedComponent ?? AdvancedComponentState.selectedPlacedComponent;
  if (!component) {
    alert("Please select a component first by clicking on it.");
    return;
  }

  const unit = component.getDefinition()?.unit;
  if (!unit) {
    const value = prompt("Enter a value for this component (e.g. 220Ω, 10µF):", component.value || "");
    if (value !== null) {
      component.value = value.trim() ? value.trim() : undefined;
      redrawCanvas();
    }
    return;
  }

  let input = prompt(`Enter a value (${VALUE_EXAMPLES[unit]}):`, component.value || "");
  while (input !== null && input.trim()) {
    const parsed = parseComponentValue(input, unit);
    if (parsed !== undefined) {
      component.value = formatComponentValue(parsed, unit);
      redrawCanvas();
      return;
    }
    input = prompt(`Couldn't understand "${input.trim()}". Try a format like ${VALUE_EXAMPLES[unit]}:`, input);
  }
  if (input !== null) {
    component.value = undefined;
    redrawCanvas();
  }
}
