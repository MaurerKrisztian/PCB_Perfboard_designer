import {ExtrudeGeometry, Group, Mesh, Shape, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

export function buildSevenSegment(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.6, height = 7, top = bottom + height;
  const housing = kit.standard("seven-segment-housing", {color: "#ece7df", roughness: 0.55});
  const face = kit.standard("seven-segment-face", {color: "#29282b", roughness: 0.65});
  const segment = kit.standard("seven-segment-red", {color: "#bd2538", emissive: "#bd2538", emissiveIntensity: 0.14, roughness: 0.4});
  group.add(kit.box(bounds.width, height, bounds.depth, housing,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  group.add(kit.box(bounds.width - 0.5, 0.08, bounds.depth - 0.5, face,
    new Vector3(bounds.centerX, top + 0.01, bounds.centerZ)));
  const centerX = bounds.centerX - bounds.width * 0.06;
  const halfWidth = bounds.width * 0.27, halfHeight = bounds.depth * 0.31;
  const thickness = Math.min(bounds.width * 0.075, 1.05);
  const addSegment = (length: number, center: Vector3, vertical = false) => {
    const outline = new Shape();
    outline.moveTo(-length / 2, 0);
    outline.lineTo(-length / 2 + thickness / 2, thickness / 2);
    outline.lineTo(length / 2 - thickness / 2, thickness / 2);
    outline.lineTo(length / 2, 0);
    outline.lineTo(length / 2 - thickness / 2, -thickness / 2);
    outline.lineTo(-length / 2 + thickness / 2, -thickness / 2);
    outline.closePath();
    const geometry = new ExtrudeGeometry(outline, {depth: 0.08, bevelEnabled: false});
    geometry.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geometry, segment);
    mesh.position.copy(center);
    if (vertical) mesh.rotation.y = Math.PI / 2;
    group.add(mesh);
  };
  for (const offsetZ of [-halfHeight, 0, halfHeight]) {
    addSegment(halfWidth * 2 - thickness * 0.5, new Vector3(centerX, top + 0.06, bounds.centerZ + offsetZ));
  }
  for (const side of [-1, 1]) {
    for (const row of [-1, 1]) {
      addSegment(halfHeight - thickness * 0.5,
        new Vector3(centerX + side * halfWidth, top + 0.06, bounds.centerZ + row * halfHeight / 2), true);
    }
  }
  group.add(cylinder(thickness * 0.58, 0.08, segment,
    new Vector3(bounds.right - thickness * 1.35, top + 0.1, bounds.centerZ + halfHeight)));
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.5, 0.4);
  return group;
}
