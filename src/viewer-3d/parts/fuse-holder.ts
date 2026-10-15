import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {PITCH, SceneKit, textPlane} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

export function buildFuseHolder(kit: SceneKit, definition: AdvancedComponentDefinition, value?: string): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.4, baseHeight = 3.2, top = bottom + baseHeight;
  const axisY = top + 3.4;
  const metal = kit.standard("fuse-clip", {color: "#cfd5db", metalness: 0.9, roughness: 0.3});
  const glass = kit.standard("fuse-glass", {color: "#d9eef7", roughness: 0.08, transparent: true, opacity: 0.45});
  const element = kit.standard("fuse-element", {color: "#8f9aa5", metalness: 0.8, roughness: 0.4});
  group.add(kit.box(bounds.width, baseHeight, bounds.depth, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + baseHeight / 2, bounds.centerZ)));
  // Insulation walls at each end, standing as tall as the fuse.
  for (const side of [-1, 1]) {
    group.add(kit.box(1.2, axisY + 2.8 - top, bounds.depth, kit.blackPlasticMaterial,
      new Vector3(bounds.centerX + side * (bounds.width / 2 - 0.6), (top + axisY + 2.8) / 2, bounds.centerZ)));
  }
  // The 5 × 20 mm fuse: a glass tube with metal end caps, held by a clip over each cap.
  const along = (radius: number, length: number, centerX: number, material = metal) => {
    const mesh = cylinder(radius, length, material, new Vector3(centerX, axisY, bounds.centerZ));
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  };
  group.add(along(2.3, 15, bounds.centerX, glass));
  group.add(along(0.12, 15, bounds.centerX, element));
  for (const side of [-1, 1]) {
    const capX = bounds.centerX + side * 7.4;
    group.add(along(2.5, 5.2, capX));
    group.add(kit.box(4, axisY - top, 0.35, metal, new Vector3(capX, (top + axisY) / 2, bounds.centerZ - 2.6)));
    group.add(kit.box(4, axisY - top, 0.35, metal, new Vector3(capX, (top + axisY) / 2, bounds.centerZ + 2.6)));
  }
  if (value) {
    const label = textPlane(value, bounds.width * 0.4, 1.6, "#e2e8f0");
    label.position.set(bounds.centerX, bottom + baseHeight / 2, bounds.front + 0.01);
    group.add(label);
  }
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.8, 0.5);
  // Each terminal runs up through the base to its clip.
  for (const offset of definition.pinOffsets) {
    const pinX = offset.dx * PITCH;
    const capX = bounds.centerX + Math.sign(pinX - bounds.centerX) * 7.4;
    group.add(kit.box(Math.abs(pinX - capX) + 0.8, 0.35, 1.6, metal,
      new Vector3((pinX + capX) / 2, top + 0.18, bounds.centerZ)));
  }
  return group;
}
