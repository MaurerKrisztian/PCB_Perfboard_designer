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
  // Side length of the rendered square body, in canvas pixels. Defaults to DEFAULT_BODY_SIZE.
  bodySize?: number;
  // Half the artwork's thickness across the lead axis, in the icon's 100-unit viewBox
  // (outline stroke included). Lets value labels hug the visible body instead of the whole
  // square icon box. Defaults to 50, i.e. the full box.
  artworkHalfThickness?: number;
}

// One grid step is GridConfig.dotSpace (50px), so the default body spans a bit more than
// hole-to-hole: a component placed between adjacent dots covers the whole gap.
export const DEFAULT_BODY_SIZE = 64;

export function getComponentBodySize(def: ComponentDefinition): number {
  return def.bodySize ?? DEFAULT_BODY_SIZE;
}

export function getIconPath(def: ComponentDefinition): string {
  return def.iconPath ?? `icons/components/${def.id}.svg`;
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {id: "resistor", category: "Passive", name: "Resistor", fallbackLabel: "R", unit: "Ω", artworkHalfThickness: 17},
  {id: "ceramic-capacitor", category: "Passive", name: "Ceramic Capacitor", fallbackLabel: "C", unit: "F", artworkHalfThickness: 38},
  {id: "electrolytic-capacitor", category: "Passive", name: "Electrolytic Capacitor", fallbackLabel: "C+", unit: "F", bodySize: 96, artworkHalfThickness: 44},
  {id: "inductor", category: "Passive", name: "Inductor", fallbackLabel: "L", unit: "H", artworkHalfThickness: 17},
  {id: "led", category: "Semiconductor", name: "LED", fallbackLabel: "LED"},
  {id: "diode", category: "Semiconductor", name: "Diode", fallbackLabel: "D", artworkHalfThickness: 18},
];

export function getComponentDefinition(id: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS.find(def => def.id === id);
}
