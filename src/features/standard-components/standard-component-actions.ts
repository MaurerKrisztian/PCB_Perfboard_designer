import {redrawCanvas} from "../draw-canvas";
import {ComponentUnit} from "./component-definitions";
import {formatComponentValue, parseComponentValue} from "./component-value";
import {SelectionState} from "../../state/SelectionState";

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
  const component = SelectionState.part;
  if (component?.kind !== "standard-component" || component.definitionId !== "led") return;
  component.color = color;
  component.value = color ? LED_COLOR_LABELS[color] : undefined;
  redrawCanvas();
}

export function setSelectedComponentValue() {
  const selected = SelectionState.part;
  const component = selected?.kind === "ic" ? undefined : selected;
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

  const definition = component.getDefinition();
  const freeForm = !!definition && "freeFormValue" in definition && !!definition.freeFormValue;
  const example = freeForm ? `${VALUE_EXAMPLES[unit]}, B10K` : VALUE_EXAMPLES[unit];

  let input = prompt(`Enter a value (${example}):`, component.value || "");
  while (input !== null && input.trim()) {
    const parsed = parseComponentValue(input, unit);
    if (parsed !== undefined || freeForm) {
      component.value = parsed !== undefined ? formatComponentValue(parsed, unit) : input.trim();
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
