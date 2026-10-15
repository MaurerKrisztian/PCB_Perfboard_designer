import {ExtrudeGeometry, Group, Mesh, Shape, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";
import {addTopLabel, bodyBounds} from "./part-geometry";

export function buildCrystal(kit: SceneKit, definition: AdvancedComponentDefinition, value?: string): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.8, height = 3.5;
  const metal = kit.standard("crystal-can", {color: "#c3c9d0", metalness: 0.95, roughness: 0.3});
  const addShell = (width: number, depth: number, shellHeight: number, base: number) => {
    const radius = depth / 2, straight = (width - depth) / 2;
    const outline = new Shape();
    outline.absarc(straight, 0, radius, -Math.PI / 2, Math.PI / 2, false);
    outline.absarc(-straight, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
    outline.closePath();
    const geometry = new ExtrudeGeometry(outline, {depth: shellHeight, bevelEnabled: false, curveSegments: 24});
    geometry.rotateX(-Math.PI / 2);
    const shell = new Mesh(geometry, metal);
    shell.position.set(bounds.centerX, base, bounds.centerZ);
    shell.castShadow = true;
    group.add(shell);
  };
  addShell(bounds.width, bounds.depth, 0.45, bottom);
  addShell(bounds.width - 0.5, bounds.depth - 0.5, height - 0.35, bottom + 0.35);
  addTopLabel(group, value || "HC-49US", bounds.width * 0.72, 1.5,
    new Vector3(bounds.centerX, bottom + height + 0.01, bounds.centerZ), "#424951");
  definition.pinOffsets.forEach((offset, index) => {
    group.add(kit.lead([
      new Vector3(offset.dx * PITCH, LEAD_TIP_Y, offset.dy * PITCH),
      new Vector3(offset.dx * PITCH, 0.2, offset.dy * PITCH),
      new Vector3(bounds.centerX + (index === 0 ? -2.44 : 2.44), bottom + 0.2, bounds.centerZ),
    ]));
  });
  return group;
}
