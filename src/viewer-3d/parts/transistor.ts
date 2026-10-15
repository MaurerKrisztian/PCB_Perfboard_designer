import {ExtrudeGeometry, Group, Mesh, Shape, Vector3} from "three";
import {LEAD_TIP_Y, PITCH, SceneKit, textPlane} from "../scene-kit";

export function buildTransistor(kit: SceneKit, value?: string): Group {
  const group = new Group();
  const radius = 2.4, flatOffset = 1.4, height = 4.6, bottom = 2.8;
  const chordHalf = Math.sqrt(radius * radius - flatOffset * flatOffset);
  const arcFrom = Math.atan2(-flatOffset, chordHalf);
  const shape = new Shape();
  shape.moveTo(-chordHalf, -flatOffset);
  shape.lineTo(chordHalf, -flatOffset);
  shape.absarc(0, 0, radius, arcFrom, Math.PI - arcFrom, false);
  const geometry = new ExtrudeGeometry(shape, {depth: height, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 2, curveSegments: 24});
  geometry.rotateX(-Math.PI / 2);
  const body = new Mesh(geometry, kit.standard("to92-body", {color: "#2b2f34", roughness: 0.5}));
  body.position.set(PITCH, bottom, 0);
  body.castShadow = true;
  group.add(body);

  for (let index = 0; index < 3; index++) {
    const contact = PITCH + (index - 1) * 1.27;
    group.add(kit.lead([new Vector3(index * PITCH, LEAD_TIP_Y, 0), new Vector3(index * PITCH, 1.2, 0), new Vector3(contact, bottom, 0), new Vector3(contact, bottom + 0.4, 0)]));
  }
  if (value) {
    const label = textPlane(value, chordHalf * 1.8, 1.1, "#c7ced6");
    label.position.set(PITCH, bottom + height * 0.62, flatOffset + 0.13);
    group.add(label);
  }
  return group;
}
