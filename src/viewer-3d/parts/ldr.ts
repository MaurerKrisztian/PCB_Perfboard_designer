import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";
import {bodyBounds, cylinder} from "./part-geometry";

export function buildLdr(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const radius = 2.55, bottom = 1.8, height = 2, top = bottom + height;
  const ceramic = kit.standard("ldr-ceramic", {color: "#d4b98a", roughness: 0.7});
  const face = kit.standard("ldr-face", {color: "#f0dbb3", roughness: 0.65});
  const sensor = kit.standard("ldr-track", {color: "#aa4e27", roughness: 0.65});
  group.add(cylinder(radius, height, ceramic, new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  group.add(cylinder(radius - 0.2, 0.08, face, new Vector3(bounds.centerX, top + 0.04, bounds.centerZ)));
  const track: Vector3[] = [];
  for (let row = 0; row < 7; row++) {
    const offsetZ = (row - 3) * 0.55;
    const halfSpan = Math.sqrt(Math.pow(radius - 0.5, 2) - offsetZ * offsetZ);
    const direction = row % 2 === 0 ? 1 : -1;
    track.push(new Vector3(bounds.centerX - direction * halfSpan, top + 0.12, bounds.centerZ + offsetZ));
    track.push(new Vector3(bounds.centerX + direction * halfSpan, top + 0.12, bounds.centerZ + offsetZ));
  }
  group.add(kit.bentWire(track, 0.1, sensor));
  definition.pinOffsets.forEach((offset, index) => {
    group.add(kit.lead([
      new Vector3(offset.dx * PITCH, LEAD_TIP_Y, offset.dy * PITCH),
      new Vector3(offset.dx * PITCH, 0.4, offset.dy * PITCH),
      new Vector3(bounds.centerX + (index === 0 ? -1.7 : 1.7), bottom + 0.3, bounds.centerZ),
    ]));
  });
  return group;
}
