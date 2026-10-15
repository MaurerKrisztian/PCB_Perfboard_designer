import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";
import {bodyBounds} from "./part-geometry";

export function buildJumperCap(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const plastic = kit.standard("jumper-blue", {color: "#2458bc", roughness: 0.48});
  group.add(kit.box(bounds.width, 5.8, bounds.depth, plastic, new Vector3(bounds.centerX, 5.5, bounds.centerZ)));
  group.add(kit.box(bounds.width, 0.45, bounds.depth + 0.25, plastic, new Vector3(bounds.centerX, 8.4, bounds.centerZ)));
  const gold = kit.standard("gold-pin", {color: "#e0b54a", metalness: 1, roughness: 0.28});
  for (const offset of definition.pinOffsets) {
    const centerX = offset.dx * PITCH, centerZ = offset.dy * PITCH;
    group.add(kit.box(PITCH - 0.06, 2.5, PITCH - 0.06, kit.blackPlasticMaterial, new Vector3(centerX, 1.25, centerZ)));
    group.add(kit.box(0.64, 3.2 - LEAD_TIP_Y, 0.64, gold, new Vector3(centerX, (3.2 + LEAD_TIP_Y) / 2, centerZ)));
  }
  return group;
}

