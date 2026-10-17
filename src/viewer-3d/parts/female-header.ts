import {Group, Vector3} from "three";
import {PinOffset} from "../../parts/advanced-component-definitions";
import {PITCH, SceneKit} from "../scene-kit";
import {addLeads} from "./part-geometry";

export function buildFemaleHeader(kit: SceneKit, offsets: PinOffset[]): Group {
  const group = new Group();
  const height = 8.5, tile = PITCH - 0.04, socket = 1.05, wall = (tile - socket) / 2;
  const contact = kit.standard("socket-contact", {color: "#b49a58", metalness: 1, roughness: 0.4});
  for (const offset of offsets) {
    const centerX = offset.dx * PITCH, centerZ = offset.dy * PITCH;
    group.add(kit.box(tile, height - 1.5, tile, kit.blackPlasticMaterial, new Vector3(centerX, (height - 1.5) / 2, centerZ)));
    group.add(kit.box(socket, 0.08, socket, contact, new Vector3(centerX, height - 1.46, centerZ)));
    for (const side of [-1, 1]) {
      group.add(kit.box(wall, 1.5, tile, kit.blackPlasticMaterial,
        new Vector3(centerX + side * (tile - wall) / 2, height - 0.75, centerZ)));
      group.add(kit.box(socket, 1.5, wall, kit.blackPlasticMaterial,
        new Vector3(centerX, height - 0.75, centerZ + side * (tile - wall) / 2)));
    }
  }
  addLeads(group, kit, offsets, 0.2, 0.64, 0.64);
  return group;
}

