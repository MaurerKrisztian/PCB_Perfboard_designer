import {Group, Vector3} from "three";
import {PinOffset} from "../../features/advanced-components/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";

export function buildUnknown(kit: SceneKit, offsets: PinOffset[]): Group {
  const group = new Group();
  const xPositions = offsets.map(offset => offset.dx * PITCH), zPositions = offsets.map(offset => offset.dy * PITCH);
  const minX = Math.min(...xPositions), maxX = Math.max(...xPositions), minZ = Math.min(...zPositions), maxZ = Math.max(...zPositions);
  group.add(kit.box(maxX - minX + 2, 3, maxZ - minZ + 2, kit.blackPlasticMaterial, new Vector3((minX + maxX) / 2, 2.5, (minZ + maxZ) / 2)));
  for (const offset of offsets) {
    group.add(kit.lead([
      new Vector3(offset.dx * PITCH, LEAD_TIP_Y, offset.dy * PITCH),
      new Vector3(offset.dx * PITCH, 1.2, offset.dy * PITCH),
    ]));
  }
  return group;
}
