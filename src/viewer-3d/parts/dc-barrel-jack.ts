import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";
import {bodyBounds, cylinder} from "./part-geometry";

// Opens toward +x (the right of the unrotated part), like its 2D artwork.
export function buildDcBarrelJack(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const height = 10.7, axisY = 6.5, collarLength = 3.5;
  const hole = kit.standard("barrel-hole", {color: "#07080a", roughness: 0.9});
  group.add(kit.box(bounds.width - collarLength, height - 0.6, bounds.depth - 0.4, kit.blackPlasticMaterial,
    new Vector3(bounds.left + (bounds.width - collarLength) / 2, (height - 0.6) / 2, bounds.centerZ)));
  group.add(kit.box(collarLength, height, bounds.depth, kit.blackPlasticMaterial,
    new Vector3(bounds.right - collarLength / 2, height / 2, bounds.centerZ)));
  const across = (radius: number, length: number, centerX: number, material = hole) => {
    const mesh = cylinder(radius, length, material, new Vector3(centerX, axisY, bounds.centerZ));
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  };
  group.add(across(3.2, 0.1, bounds.right + 0.01));
  group.add(across(1, 1.2, bounds.right - 0.5, kit.leadMaterial));
  for (const offset of definition.pinOffsets) {
    const pinX = offset.dx * PITCH, pinZ = offset.dy * PITCH;
    const inside = pinZ >= bounds.back && pinZ <= bounds.front;
    group.add(kit.lead(inside
      ? [new Vector3(pinX, LEAD_TIP_Y, pinZ), new Vector3(pinX, 0.6, pinZ)]
      : [new Vector3(pinX, LEAD_TIP_Y, pinZ), new Vector3(pinX, 3, pinZ), new Vector3(pinX, 3, bounds.back + 0.3)]));
  }
  return group;
}
