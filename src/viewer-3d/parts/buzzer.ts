import {ExtrudeGeometry, Group, Mesh, Path, Shape, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";
import {addTopLabel, bodyBounds, cylinder} from "./part-geometry";

export function buildBuzzer(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const radius = Math.min(bounds.width, bounds.depth) / 2;
  const bottom = 1.2, height = 9.5;
  const shell = new Shape();
  shell.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const opening = new Path();
  opening.absarc(0, 0, 1.2, 0, Math.PI * 2, true);
  shell.holes.push(opening);
  const geometry = new ExtrudeGeometry(shell, {depth: height, bevelEnabled: false, curveSegments: 32});
  geometry.rotateX(-Math.PI / 2);
  const body = new Mesh(geometry, kit.blackPlasticMaterial);
  body.position.set(bounds.centerX, bottom, bounds.centerZ);
  body.castShadow = true;
  group.add(body);
  group.add(cylinder(radius - 0.2, 0.3, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + 0.15, bounds.centerZ)));
  addTopLabel(group, "+", 1.8, 1.8, new Vector3(bounds.centerX - radius * 0.62, bottom + height + 0.01, bounds.centerZ));
  definition.pinOffsets.forEach((offset, index) => {
    const contactX = bounds.centerX + (index === 0 ? -3.25 : 3.25);
    group.add(kit.lead([
      new Vector3(offset.dx * PITCH, LEAD_TIP_Y, offset.dy * PITCH),
      new Vector3(offset.dx * PITCH, 0.2, offset.dy * PITCH),
      new Vector3(contactX, bottom + 0.3, bounds.centerZ),
    ]));
  });
  return group;
}

