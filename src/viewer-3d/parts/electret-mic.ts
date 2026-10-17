import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

// Capsule standing on its two PC pins, sound port facing up.
export function buildElectretMic(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const radius = 4.85, bottom = 2, height = 4.5, top = bottom + height;
  const can = kit.standard("mic-can", {color: "#9aa3ad", metalness: 0.9, roughness: 0.35});
  const felt = kit.standard("mic-felt", {color: "#1d2025", roughness: 0.95});
  group.add(cylinder(radius, height, can, new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  group.add(cylinder(radius - 0.9, 0.08, felt, new Vector3(bounds.centerX, top + 0.04, bounds.centerZ)));
  addLeads(group, kit, definition.pinOffsets, bottom + 0.2, 0.45, 0.45);
  return group;
}
