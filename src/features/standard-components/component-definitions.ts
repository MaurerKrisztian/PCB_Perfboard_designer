export interface ComponentDefinition {
  id: string;
  category: string;
  name: string;
  iconPath?: string;
  fallbackLabel: string;
}

export function getIconPath(def: ComponentDefinition): string {
  return def.iconPath ?? `/icons/components/${def.id}.svg`;
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {id: "resistor", category: "Passive", name: "Resistor", fallbackLabel: "R"},
  {id: "ceramic-capacitor", category: "Passive", name: "Ceramic Capacitor", fallbackLabel: "C"},
  {id: "electrolytic-capacitor", category: "Passive", name: "Electrolytic Capacitor", fallbackLabel: "C+"},
  {id: "led", category: "Semiconductor", name: "LED", fallbackLabel: "LED"},
  {id: "diode", category: "Semiconductor", name: "Diode", fallbackLabel: "D"},
];

export function getComponentDefinition(id: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITIONS.find(def => def.id === id);
}
