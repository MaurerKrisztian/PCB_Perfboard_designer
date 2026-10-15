// The unit a component's value is expressed in. Drives both how the value-entry
// prompt parses user input (SI prefixes, shorthand notations) and how it's displayed.
export type ComponentUnit = "Ω" | "F" | "H";

import {CategoryId} from "../catalog/catalog-categories";

export interface ComponentDefinition {
  id: string;
  // Where the part is listed in the Components panel tree (see catalog-categories.ts).
  category: CategoryId;
  name: string;
  // Extra search terms (abbreviations, part families) that don't appear in `name`.
  keywords?: string[];
  // Letters of a placed part's reference designator: "R" makes R1, R2...
  refPrefix: string;
  iconPath?: string;
  fallbackLabel: string;
  unit?: ComponentUnit;
  // Side length of the rendered square body, in canvas pixels. Defaults to DEFAULT_BODY_SIZE.
  bodySize?: number;
  // Half the artwork's thickness across the lead axis, in the icon's 100-unit viewBox
  // (outline stroke included). Lets value labels hug the visible body instead of the whole
  // square icon box. Defaults to 50, i.e. the full box.
  artworkHalfThickness?: number;
  // A colored LED: the context menu offers its color, which tints the body and becomes its value.
  led?: boolean;
}

// One grid step is GridConfig.dotSpace (50px), so the default body spans a bit more than
// hole-to-hole: a component placed between adjacent dots covers the whole gap.
export const DEFAULT_BODY_SIZE = 64;

export function getComponentBodySize(def: ComponentDefinition): number {
  return def.bodySize ?? DEFAULT_BODY_SIZE;
}

// Relative to the editor page (app/index.html), which sits one level below the site root
// where the publicDir icons are served. Relative rather than "/icons/...", so the site works
// both at perfboarddesigner.com and under the GitHub Pages subfolder /perfboard-designer/.
export const COMPONENT_ICON_DIR = "../icons/components/";

export function getIconPath(def: ComponentDefinition): string {
  return def.iconPath ?? `${COMPONENT_ICON_DIR}${def.id}.svg`;
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {id: "resistor", refPrefix: "R", category: "passives.resistors", name: "Resistor", keywords: ["res"], fallbackLabel: "R", unit: "Ω", artworkHalfThickness: 17},
  {id: "ceramic-capacitor", refPrefix: "C", category: "passives.capacitors", name: "Ceramic Capacitor", keywords: ["cap", "mlcc", "disc"], fallbackLabel: "C", unit: "F", artworkHalfThickness: 38},
  {id: "electrolytic-capacitor", refPrefix: "C", category: "passives.capacitors", name: "Electrolytic Capacitor", keywords: ["cap", "polarized", "elco"], fallbackLabel: "C+", unit: "F", bodySize: 96, artworkHalfThickness: 44},
  {id: "inductor", refPrefix: "L", category: "passives", name: "Inductor", keywords: ["coil", "choke"], fallbackLabel: "L", unit: "H", artworkHalfThickness: 17},
  {id: "led", refPrefix: "D", category: "semiconductors.diodes", name: "LED", keywords: ["light", "light emitting diode", "5mm"], fallbackLabel: "LED", led: true},
  {id: "led-3mm", refPrefix: "D", category: "semiconductors.diodes", name: "LED (3 mm)", keywords: ["light", "light emitting diode", "3mm", "t-1", "indicator"], fallbackLabel: "LED", iconPath: `${COMPONENT_ICON_DIR}led.svg`, bodySize: 46, led: true},
  {id: "diode", refPrefix: "D", category: "semiconductors.diodes", name: "Diode", keywords: ["rectifier", "1n4148", "1n4007"], fallbackLabel: "D", artworkHalfThickness: 18},
];

export function getComponentDefinition(id: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS.find(def => def.id === id);
}

export function isLed(definitionId: string): boolean {
  return getComponentDefinition(definitionId)?.led === true;
}
