import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {PITCH, SceneKit} from "../scene-kit";
import {addLeads, bodyBounds} from "./part-geometry";

// Open-top housing with square pins standing in it and the polarizing slot along the back.
export function buildJstXh(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const height = 7, floor = 1.5, wall = 0.6;
  const nylon = kit.standard("jst-nylon", {color: "#efe6cc", roughness: 0.6});
  const pinMaterial = kit.standard("jst-pin", {color: "#d9c27a", metalness: 0.9, roughness: 0.35});
  group.add(kit.box(bounds.width, floor, bounds.depth, nylon, new Vector3(bounds.centerX, floor / 2, bounds.centerZ)));
  const wallHeight = height - floor, wallY = floor + wallHeight / 2;
  group.add(kit.box(bounds.width, wallHeight, wall, nylon, new Vector3(bounds.centerX, wallY, bounds.front - wall / 2)));
  group.add(kit.box(wall, wallHeight, bounds.depth, nylon, new Vector3(bounds.left + wall / 2, wallY, bounds.centerZ)));
  group.add(kit.box(wall, wallHeight, bounds.depth, nylon, new Vector3(bounds.right - wall / 2, wallY, bounds.centerZ)));
  // The back wall has the latch slot cut into its middle.
  const slot = Math.min(2.4, bounds.width * 0.3);
  const side = (bounds.width - slot) / 2;
  for (const sign of [-1, 1]) {
    group.add(kit.box(side, wallHeight, wall, nylon,
      new Vector3(bounds.centerX + sign * (slot + side) / 2, wallY, bounds.back + wall / 2)));
  }
  for (const offset of definition.pinOffsets) {
    group.add(kit.box(0.64, height - 0.5 - floor, 0.64, pinMaterial,
      new Vector3(offset.dx * PITCH, floor + (height - 0.5 - floor) / 2, offset.dy * PITCH)));
  }
  addLeads(group, kit, definition.pinOffsets, floor, 0.64, 0.64);
  return group;
}
