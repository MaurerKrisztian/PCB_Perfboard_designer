import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";
import {bodyBounds, cylinder} from "./part-geometry";

export function buildRotaryEncoder(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.5, baseHeight = 4.4, frameHeight = 2.1;
  const top = bottom + baseHeight + frameHeight;
  const metal = kit.standard("encoder-metal", {color: "#b9c1ca", metalness: 0.9, roughness: 0.35});
  const shaft = kit.standard("encoder-shaft", {color: "#dfe3e8", metalness: 0.9, roughness: 0.45});
  group.add(kit.box(bounds.width - 0.4, baseHeight, bounds.depth - 0.4, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + baseHeight / 2, bounds.centerZ)));
  group.add(kit.box(bounds.width, frameHeight, bounds.depth, metal,
    new Vector3(bounds.centerX, bottom + baseHeight + frameHeight / 2, bounds.centerZ)));
  // M7 bushing, then the 6 mm shaft with a knurled top.
  const bushingHeight = 5, shaftHeight = 13;
  group.add(cylinder(3.5, bushingHeight, metal, new Vector3(bounds.centerX, top + bushingHeight / 2, bounds.centerZ)));
  const shaftBase = top + bushingHeight;
  group.add(cylinder(3, shaftHeight, shaft, new Vector3(bounds.centerX, shaftBase + shaftHeight / 2, bounds.centerZ)));
  group.add(cylinder(3.05, 7, kit.standard("encoder-knurl", {color: "#9aa3ad", metalness: 0.85, roughness: 0.6}),
    new Vector3(bounds.centerX, shaftBase + shaftHeight - 3.5, bounds.centerZ)));
  group.add(kit.box(4, 0.06, 0.5, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, shaftBase + shaftHeight + 0.02, bounds.centerZ)));
  // The pins leave the body's edges, then drop through the board.
  for (const offset of definition.pinOffsets) {
    const pinX = offset.dx * PITCH, pinZ = offset.dy * PITCH;
    const edgeZ = Math.min(Math.max(pinZ, bounds.back + 0.6), bounds.front - 0.6);
    group.add(kit.lead([
      new Vector3(pinX, LEAD_TIP_Y, pinZ),
      new Vector3(pinX, bottom + 0.6, pinZ),
      new Vector3(pinX, bottom + 0.6, edgeZ),
    ]));
  }
  return group;
}
