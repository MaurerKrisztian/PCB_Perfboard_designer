import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

export interface CellLayout {
  // Cell size in mm (AA: 14.5 × 50.5, 18650: 18.6 × 65).
  diameter: number;
  length: number;
  wrap: string;
  // One entry per cell, front-to-back across the holder: whether its + end points to +x.
  plusTowardRight: boolean[];
}

// Open holder for cylindrical cells laid along x: a floor, end walls with the contacts, and the
// cells themselves with their + caps.
export function buildCellHolder(kit: SceneKit, definition: AdvancedComponentDefinition, layout: CellLayout): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const floor = 1.2, wallHeight = layout.diameter * 0.75;
  const wrap = kit.standard(`cell-wrap-${layout.wrap}`, {color: layout.wrap, roughness: 0.4});
  const metal = kit.standard("cell-metal", {color: "#c3c9d0", metalness: 0.95, roughness: 0.28});
  group.add(kit.box(bounds.width, floor, bounds.depth, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, floor / 2, bounds.centerZ)));
  for (const sign of [-1, 1]) {
    group.add(kit.box(1.6, wallHeight, bounds.depth, kit.blackPlasticMaterial,
      new Vector3(bounds.centerX + sign * (bounds.width / 2 - 0.8), floor + wallHeight / 2, bounds.centerZ)));
    group.add(kit.box(bounds.width, wallHeight * 0.5, 1, kit.blackPlasticMaterial,
      new Vector3(bounds.centerX, floor + wallHeight * 0.25, bounds.centerZ + sign * (bounds.depth / 2 - 0.5))));
  }
  const count = layout.plusTowardRight.length;
  const pitchZ = bounds.depth / count;
  const axisY = floor + layout.diameter / 2 + 0.3;
  layout.plusTowardRight.forEach((plusRight, index) => {
    const z = bounds.back + (index + 0.5) * pitchZ;
    const body = cylinder(layout.diameter / 2, layout.length - 1.5, wrap, new Vector3(bounds.centerX, axisY, z));
    body.rotation.z = Math.PI / 2;
    group.add(body);
    const capX = bounds.centerX + (plusRight ? 1 : -1) * (layout.length / 2 - 0.75);
    const cap = cylinder(layout.diameter * 0.2, 1.5, metal, new Vector3(capX, axisY, z));
    cap.rotation.z = Math.PI / 2;
    group.add(cap);
  });
  addLeads(group, kit, definition.pinOffsets, floor * 0.5, 0.8, 0.4);
  return group;
}
