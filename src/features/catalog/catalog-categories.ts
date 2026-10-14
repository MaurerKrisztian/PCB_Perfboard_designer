// The Components panel's category tree. Array order is display order (siblings are shown in
// the order they appear here). A category can hold both subcategories and components.
//
// To add a category: add one line here. `parentId` must name a category declared in this
// list - a typo fails to compile, since CATALOG_CATEGORIES below only accepts known ids.
// Categories with nothing in them (no components, no non-empty subcategories) are hidden.
const CATEGORY_LIST = [
  {id: "passives", name: "Passives", icon: "〰️", keywords: ["passive"]},
  {id: "passives.resistors", parentId: "passives", name: "Resistors", keywords: ["resistance", "ohm"]},
  {id: "passives.capacitors", parentId: "passives", name: "Capacitors", keywords: ["cap", "capacitance", "farad"]},

  {id: "semiconductors", name: "Semiconductors", icon: "💡", keywords: ["semiconductor", "active"]},
  {id: "semiconductors.diodes", parentId: "semiconductors", name: "Diodes"},
  {id: "semiconductors.transistors", parentId: "semiconductors", name: "Transistors"},

  {id: "ics", name: "ICs", icon: "🔲", keywords: ["ic", "chip", "integrated circuit", "dip"]},
  {id: "ics.timers", parentId: "ics", name: "Timers"},
  {id: "ics.logic", parentId: "ics", name: "Logic", keywords: ["gate", "74"]},
  {id: "ics.microcontrollers", parentId: "ics", name: "Microcontrollers", keywords: ["mcu", "avr"]},
  {id: "ics.custom", parentId: "ics", name: "Custom"},

  {id: "modules", name: "Modules", icon: "📟", keywords: ["module", "board", "breakout"]},
  {id: "modules.dev-boards", parentId: "modules", name: "Dev Boards", keywords: ["development board", "microcontroller", "mcu"]},
  {id: "modules.custom", parentId: "modules", name: "Custom"},

  {id: "connectors", name: "Connectors", icon: "🔌", keywords: ["connector", "header"]},
] as const;

export type CategoryId = typeof CATEGORY_LIST[number]["id"];

export interface CatalogCategory {
  id: CategoryId;
  parentId?: CategoryId;
  name: string;
  icon?: string;
  keywords?: readonly string[];
}

export const CATALOG_CATEGORIES: readonly CatalogCategory[] = CATEGORY_LIST;

// For category ids read back from storage/project files, which may predate a rename.
export function isCategoryId(value: unknown): value is CategoryId {
  return CATALOG_CATEGORIES.some(c => c.id === value);
}

export function getCategory(id: CategoryId): CatalogCategory {
  const category = CATALOG_CATEGORIES.find(c => c.id === id);
  if (!category) throw new Error(`Unknown catalog category: ${id}`);
  return category;
}

// Root-first chain of categories down to (and including) `id`, e.g. for breadcrumbs.
export function getCategoryPath(id: CategoryId): CatalogCategory[] {
  const path: CatalogCategory[] = [];
  let current: CatalogCategory | undefined = getCategory(id);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getCategory(current.parentId) : undefined;
  }
  return path;
}

// Direct children of `parentId`, or the top-level categories when it's omitted.
export function getChildCategories(parentId?: CategoryId): CatalogCategory[] {
  return CATALOG_CATEGORIES.filter(c => c.parentId === parentId);
}
