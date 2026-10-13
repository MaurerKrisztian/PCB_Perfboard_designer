import {COMPONENT_DEFINITIONS, getIconPath} from "../standard-components/component-definitions";
import {ADVANCED_COMPONENT_DEFINITIONS, getAdvancedIconPath} from "../advanced-components/advanced-component-definitions";
import {deleteCustomIc, Ic, selectIc} from "../ic";
import {getIcDefinition} from "../ic-definitions";
import {editCustomIc, openIcEditor} from "../ic-editor-modal";
import {ToolState} from "../../state/ToolState";
import {setActiveTool} from "../active-tool";
import {CategoryId} from "./catalog-categories";

// One entry in the Components panel, whichever placement system backs it. The panel and search
// only ever deal with these - activate/isArmed/remove hide which system a part belongs to.
export interface CatalogItem {
  // Unique across all sources, e.g. "standard:resistor", "ic:ne555", "action:custom".
  key: string;
  // Actions (e.g. "Custom…") open something instead of arming a part for placement.
  isAction: boolean;
  name: string;
  // Omitted for top-level entries that sit above the category tree (the Custom… action).
  categoryId?: CategoryId;
  keywords: readonly string[];
  // Artwork next to the name; `emoji` stands in when there's no icon file or it fails to load.
  iconPath?: string;
  emoji: string;
  activate: () => void;
  // Whether this is the part currently armed for placement.
  isArmed: () => boolean;
  // Only on user-created parts.
  edit?: () => void;
  remove?: () => void;
}

function isArmed(kind: "standard-component" | "advanced-component", definitionId: string): boolean {
  const active = ToolState.active;
  return active.kind === kind && active.definitionId === definitionId;
}

const CUSTOM_ACTION_KEYWORDS = ["custom", "new", "create", "add"];

// Built fresh on every call: custom ICs come and go at runtime, and the catalog is small.
// Within a category, items appear in this order: actions, then each source's definition order.
export function buildCatalog(): CatalogItem[] {
  const items: CatalogItem[] = [
    {
      key: "action:custom", isAction: true, name: "Custom…",
      keywords: CUSTOM_ACTION_KEYWORDS, emoji: "➕",
      activate: () => openIcEditor("ic"), isArmed: () => false
    },
  ];

  for (const def of COMPONENT_DEFINITIONS) {
    items.push({
      key: `standard:${def.id}`, isAction: false, name: def.name, categoryId: def.category,
      keywords: def.keywords ?? [], iconPath: getIconPath(def), emoji: "🧩",
      // Clicking the already-armed part again disarms it
      activate: () => setActiveTool(isArmed("standard-component", def.id)
        ? {kind: "select"}
        : {kind: "standard-component", definitionId: def.id}),
      isArmed: () => isArmed("standard-component", def.id)
    });
  }

  for (const def of ADVANCED_COMPONENT_DEFINITIONS) {
    items.push({
      key: `advanced:${def.id}`, isAction: false, name: def.name, categoryId: def.category,
      keywords: def.keywords ?? [], iconPath: getAdvancedIconPath(def), emoji: "🧩",
      activate: () => setActiveTool(isArmed("advanced-component", def.id)
        ? {kind: "select"}
        : {kind: "advanced-component", definitionId: def.id, rotation: 0}),
      isArmed: () => isArmed("advanced-component", def.id)
    });
  }

  for (const ic of Ic.IC_CONTAINER) {
    const def = ic.definitionId ? getIcDefinition(ic.definitionId) : undefined;
    items.push({
      key: `ic:${ic.definitionId ?? ic.id}`, isAction: false, name: ic.name, categoryId: ic.category,
      keywords: def?.keywords ?? [], emoji: ic.category.indexOf("modules") === 0 ? "📟" : "📦",
      activate: () => selectIc(ic.id),
      isArmed: () => {
        const active = ToolState.active;
        return active.kind === "ic" && active.template.armedFrom === ic;
      },
      edit: ic.isCustom ? () => editCustomIc(ic) : undefined,
      remove: ic.isCustom ? () => deleteCustomIc(ic.id) : undefined
    });
  }

  return items;
}
