import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {PITCH, SceneKit} from "../scene-kit";
import {addLeads, addTopLabel, bodyBounds} from "./part-geometry";

export function buildDipSwitch(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.5, height = 4.5, top = bottom + height;
  const housing = kit.standard("dip-switch-red", {color: "#b5282e", roughness: 0.5});
  const actuator = kit.standard("dip-switch-actuator", {color: "#f5efe2", roughness: 0.55});
  group.add(kit.box(bounds.width, height, bounds.depth, housing,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  const columns = [...new Set(definition.pinOffsets.map(offset => offset.dx))].sort((left, right) => left - right);
  columns.forEach((column, index) => {
    const centerX = column * PITCH;
    group.add(kit.box(1.8, 0.08, 3.1, kit.blackPlasticMaterial, new Vector3(centerX, top + 0.02, bounds.centerZ)));
    group.add(kit.box(1.45, 0.75, 1.25, actuator, new Vector3(centerX, top + 0.4, bounds.centerZ + 0.7)));
    addTopLabel(group, String(index + 1), 1.7, 1.1, new Vector3(centerX, top + 0.01, bounds.front - 0.9));
  });
  addTopLabel(group, "ON", Math.min(bounds.width - 1, 4), 1.1,
    new Vector3(bounds.centerX, top + 0.01, bounds.back + 1));
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3);
  return group;
}
