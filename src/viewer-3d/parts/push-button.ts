import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

export function buildPushButton(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.6, height = 2.3;
  group.add(kit.box(bounds.width, height, bounds.depth, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  group.add(kit.box(bounds.width - 0.3, 0.35, bounds.depth - 0.3, kit.leadMaterial,
    new Vector3(bounds.centerX, bottom + height, bounds.centerZ)));
  const radius = Math.min(bounds.width, bounds.depth) * 0.28;
  group.add(cylinder(radius + 0.3, 0.25, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + height + 0.22, bounds.centerZ)));
  group.add(cylinder(radius, 1.8, kit.standard("button-red", {color: "#d9413c", roughness: 0.45}),
    new Vector3(bounds.centerX, bottom + height + 1, bounds.centerZ)));
  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      group.add(cylinder(0.25, 0.12, kit.blackPlasticMaterial,
        new Vector3(bounds.centerX + sideX * (bounds.width / 2 - 0.65), bottom + height + 0.22,
          bounds.centerZ + sideZ * (bounds.depth / 2 - 0.65))));
    }
  }
  addLeads(group, kit, definition.pinOffsets, bottom + 0.4);
  return group;
}

