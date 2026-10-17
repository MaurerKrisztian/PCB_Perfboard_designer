import {Group, Mesh, MeshPhysicalMaterial, SphereGeometry, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";
import {cylinder} from "./part-geometry";

export function buildRgbLed(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const centerX = definition.pinOffsets.reduce((total, offset) => total + offset.dx * PITCH, 0) / definition.pinOffsets.length;
  const bottom = 3, flangeHeight = 0.7, straightHeight = 4.5, radius = 2.5;
  const epoxy = new MeshPhysicalMaterial({color: "#eef3f8", transparent: true, opacity: 0.38, roughness: 0.12, clearcoat: 1, depthWrite: false});
  group.add(cylinder(2.9, flangeHeight, epoxy, new Vector3(centerX, bottom + flangeHeight / 2, 0)));
  group.add(cylinder(radius, straightHeight, epoxy, new Vector3(centerX, bottom + flangeHeight + straightHeight / 2, 0)));
  const dome = new Mesh(new SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), epoxy);
  dome.position.set(centerX, bottom + flangeHeight + straightHeight, 0);
  dome.castShadow = true;
  group.add(dome);
  definition.pinOffsets.forEach((offset, index) => {
    const contactX = centerX + (index - 1.5) * 1.27;
    group.add(kit.lead([
      new Vector3(offset.dx * PITCH, LEAD_TIP_Y, offset.dy * PITCH),
      new Vector3(offset.dx * PITCH, 1.2, offset.dy * PITCH),
      new Vector3(contactX, bottom, 0),
      new Vector3(contactX, bottom + 2.3, 0),
    ]));
  });
  ["#ef4444", "#22c55e", "#3b82f6"].forEach((color, index) => {
    const material = kit.standard(`rgb-emitter:${color}`, {color, emissive: color, emissiveIntensity: 0.3, roughness: 0.3});
    group.add(kit.box(0.7, 0.5, 0.8, material, new Vector3(centerX + (index - 1) * 1.1, bottom + 2.5, 0.15)));
  });
  return group;
}

