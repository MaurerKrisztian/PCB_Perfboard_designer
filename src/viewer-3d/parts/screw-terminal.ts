import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {PITCH, SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

export function buildScrewTerminal(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.3, height = 8.5, top = bottom + height;
  const plastic = kit.standard("terminal-green", {color: "#218454", roughness: 0.48});
  const recess = kit.standard("terminal-recess", {color: "#0b261b", roughness: 0.8});
  group.add(kit.box(bounds.width, height, bounds.depth, plastic,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  for (const offset of definition.pinOffsets) {
    const centerX = offset.dx * PITCH;
    const screwZ = bounds.back + bounds.depth * 0.43;
    group.add(cylinder(1.8, 0.1, recess, new Vector3(centerX, top + 0.02, screwZ)));
    group.add(cylinder(1.4, 0.16, kit.leadMaterial, new Vector3(centerX, top + 0.06, screwZ)));
    const slot = kit.box(2.4, 0.03, 0.35, recess, new Vector3(centerX, top + 0.15, screwZ));
    slot.rotation.y = Math.PI / 5;
    group.add(slot);
    group.add(kit.box(3.4, 3.2, 0.06, recess, new Vector3(centerX, bottom + 3.5, bounds.front + 0.02)));
    group.add(kit.box(2.5, 0.45, 0.08, kit.leadMaterial, new Vector3(centerX, bottom + 2.25, bounds.front + 0.06)));
  }
  addLeads(group, kit, definition.pinOffsets, bottom + 0.2, 0.8, 0.7);
  return group;
}

