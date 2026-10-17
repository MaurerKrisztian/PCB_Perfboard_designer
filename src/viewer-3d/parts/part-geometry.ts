import {CylinderGeometry, Group, Material, Mesh, Vector3} from "three";
import {AdvancedComponentDefinition, PinOffset} from "../../parts/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit, textPlane} from "../scene-kit";

export function bodyBounds(definition: AdvancedComponentDefinition) {
  const points = definition.bodyOutline ?? definition.pinOffsets;
  const padding = definition.bodyOutline ? 0 : PITCH * 0.5;
  const left = Math.min(...points.map(point => point.dx * PITCH)) - padding;
  const right = Math.max(...points.map(point => point.dx * PITCH)) + padding;
  const back = Math.min(...points.map(point => point.dy * PITCH)) - padding;
  const front = Math.max(...points.map(point => point.dy * PITCH)) + padding;
  return {left, right, back, front, width: right - left, depth: front - back, centerX: (left + right) / 2, centerZ: (back + front) / 2};
}

export function addLeads(group: Group, kit: SceneKit, offsets: PinOffset[], top: number, width = 0.6, depth = 0.4): void {
  for (const offset of offsets) {
    group.add(kit.box(width, top - LEAD_TIP_Y, depth, kit.leadMaterial,
      new Vector3(offset.dx * PITCH, (top + LEAD_TIP_Y) / 2, offset.dy * PITCH)));
  }
}

export function cylinder(radius: number, height: number, material: Material, center: Vector3): Mesh {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, height, 32), material);
  mesh.position.copy(center);
  mesh.castShadow = true;
  return mesh;
}

export function addTopLabel(group: Group, text: string, width: number, height: number, position: Vector3, color = "#e2e8f0"): void {
  const label = textPlane(text, width, height, color);
  label.rotation.x = -Math.PI / 2;
  label.position.copy(position);
  group.add(label);
}
