// The unit a component's value is expressed in. Drives both how the value-entry
// prompt parses user input (SI prefixes, shorthand notations) and how it's displayed.
export type ComponentUnit = "Ω" | "F" | "H";

export interface ComponentDefinition {
  id: string;
  category: string;
  name: string;
  iconPath?: string;
  fallbackLabel: string;
  unit?: ComponentUnit;
}

export function getIconPath(def: ComponentDefinition): string {
  return def.iconPath ?? `icons/components/${def.id}.svg`;
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {id: "resistor", category: "Passive", name: "Resistor", fallbackLabel: "R", unit: "Ω"},
  {id: "ceramic-capacitor", category: "Passive", name: "Ceramic Capacitor", fallbackLabel: "C", unit: "F"},
  {id: "electrolytic-capacitor", category: "Passive", name: "Electrolytic Capacitor", fallbackLabel: "C+", unit: "F"},
  {id: "inductor", category: "Passive", name: "Inductor", fallbackLabel: "L", unit: "H"},
  {id: "led", category: "Semiconductor", name: "LED", fallbackLabel: "LED"},
  {id: "diode", category: "Semiconductor", name: "Diode", fallbackLabel: "D"},
];

export function getComponentDefinition(id: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS.find(def => def.id === id);
}
