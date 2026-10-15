import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds} from "./part-geometry";

export function buildLatchingSwitch(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.5, height = 8.5, top = bottom + height;
  const housing = kit.standard("latching-housing", {color: "#2b4a73", roughness: 0.5});
  const plunger = kit.standard("latching-plunger", {color: "#e5e7eb", roughness: 0.45});
  group.add(kit.box(bounds.width, height, bounds.depth, housing,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  group.add(kit.box(3.6, 4, 3.6, plunger, new Vector3(bounds.centerX, top + 2, bounds.centerZ)));
  group.add(kit.box(2.2, 0.06, 2.2, kit.standard("latching-plunger-top", {color: "#cbd0d6", roughness: 0.5}),
    new Vector3(bounds.centerX, top + 4.03, bounds.centerZ)));
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.5, 0.3);
  return group;
}
