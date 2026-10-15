import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {PITCH, SceneKit} from "../scene-kit";
import {addLeads, addTopLabel, bodyBounds, cylinder} from "./part-geometry";

export function buildRelay(kit: SceneKit, definition: AdvancedComponentDefinition, value?: string): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.4, height = 10.8;
  const plastic = kit.standard("relay-blue", {color: "#24658d", roughness: 0.48});
  group.add(kit.box(bounds.width - 0.2, 0.8, bounds.depth - 0.2, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + 0.4, bounds.centerZ)));
  group.add(kit.box(bounds.width, height, bounds.depth, plastic,
    new Vector3(bounds.centerX, bottom + 0.7 + height / 2, bounds.centerZ)));
  const top = bottom + 0.7 + height + 0.01;
  addTopLabel(group, "G5V-2", bounds.width * 0.75, 2.2, new Vector3(bounds.centerX, top, bounds.centerZ - 1.8));
  addTopLabel(group, value || "DPDT RELAY", bounds.width * 0.75, 1.5, new Vector3(bounds.centerX, top, bounds.centerZ + 1.2));
  const firstPin = definition.pinOffsets[0];
  group.add(cylinder(0.45, 0.03, kit.blackPlasticMaterial, new Vector3(firstPin.dx * PITCH, top, firstPin.dy * PITCH)));
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.5, 0.4);
  return group;
}

