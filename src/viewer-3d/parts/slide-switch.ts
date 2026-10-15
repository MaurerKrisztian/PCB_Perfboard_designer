import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds} from "./part-geometry";

export function buildSlideSwitch(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.5, height = 4;
  group.add(kit.box(bounds.width, height, bounds.depth, kit.leadMaterial,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  group.add(kit.box(bounds.width * 0.7, 0.08, bounds.depth * 0.65, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + height + 0.03, bounds.centerZ)));
  const sliderX = bounds.centerX - bounds.width * 0.17;
  group.add(kit.box(bounds.width * 0.3, 2.8, bounds.depth * 0.5, kit.blackPlasticMaterial,
    new Vector3(sliderX, bottom + height + 1.4, bounds.centerZ)));
  const ridges = kit.standard("switch-ridges", {color: "#363b42", roughness: 0.6});
  for (const offset of [-0.6, 0, 0.6]) {
    group.add(kit.box(0.15, 0.15, bounds.depth * 0.5, ridges,
      new Vector3(sliderX + offset, bottom + height + 2.85, bounds.centerZ)));
  }
  addLeads(group, kit, definition.pinOffsets, bottom + 0.2);
  return group;
}

