import {CylinderGeometry, Group, Mesh, Vector3} from "three";
import {formatComponentValue, parseComponentValue} from "../../features/standard-components/component-value";
import {PITCH, SceneKit, textPlane} from "../scene-kit";
import {addLeads} from "./part-geometry";

export function buildPotentiometer(kit: SceneKit, value?: string): Group {
  const group = new Group();
  const left = -0.3 * PITCH, right = 4.3 * PITCH, back = -1.3 * PITCH, front = 0.3 * PITCH;
  const bottom = 0.6, height = 12;
  const cx = (left + right) / 2;
  const axisY = bottom + height / 2;
  const bodyMaterial = kit.standard("pot-body", {color: "#2d3138", roughness: 0.55});
  const metal = kit.standard("pot-metal", {color: "#c4cad2", metalness: 1, roughness: 0.3});
  group.add(kit.box(right - left, height, front - back, bodyMaterial, new Vector3(cx, bottom + height / 2, (front + back) / 2)));

  const along = (radius: number, length: number, z0: number, segments = 40) => {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, length, segments), metal);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(cx, axisY, z0 + length / 2);
    mesh.castShadow = true;
    return mesh;
  };
  group.add(along(5.6, 0.5, front));
  const bushingEnd = 2.3 * PITCH;
  group.add(along(3.4, bushingEnd - front - 0.5, front + 0.5, 28));
  const shaftLength = 7;
  const shaft = along(3.0, shaftLength, bushingEnd, 36);
  shaft.material = kit.standard("pot-shaft", {color: "#dfe3e8", metalness: 0.9, roughness: 0.45});
  group.add(shaft);
  group.add(kit.box(6.0, 0.7, 0.6, kit.blackPlasticMaterial, new Vector3(cx, axisY, bushingEnd + shaftLength + 0.01)));

  const leads = new Group();
  addLeads(leads, kit, [{dx: 0, dy: 0}, {dx: 2, dy: 0}, {dx: 4, dy: 0}], bottom + 0.2, 1.0, 0.4);
  group.add(leads);
  const ohms = value ? parseComponentValue(value, "Ω") : undefined;
  const text = ohms !== undefined ? formatComponentValue(ohms, "Ω") : value;
  if (text) {
    const label = textPlane(text, (right - left) * 0.7, 2.2, "#e2e8f0");
    label.rotation.x = -Math.PI / 2;
    label.position.set(cx, bottom + height + 0.01, (front + back) / 2);
    group.add(label);
  }
  return group;
}
