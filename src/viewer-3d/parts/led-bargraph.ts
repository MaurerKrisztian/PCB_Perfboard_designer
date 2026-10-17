import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {PITCH, SceneKit} from "../scene-kit";
import {addLeads, bodyBounds} from "./part-geometry";

export function buildLedBargraph(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.5, height = 8, top = bottom + height;
  const housing = kit.standard("bargraph-housing", {color: "#2a2a2e", roughness: 0.6});
  const segment = kit.standard("bargraph-red", {color: "#d02a3a", emissive: "#d02a3a", emissiveIntensity: 0.18, roughness: 0.35});
  group.add(kit.box(bounds.width, height, bounds.depth, housing,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  const columns = [...new Set(definition.pinOffsets.map(offset => offset.dx))];
  for (const column of columns) {
    group.add(kit.box(1.3, 0.1, bounds.depth * 0.45, segment, new Vector3(column * PITCH, top + 0.04, bounds.centerZ)));
  }
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.5, 0.3);
  return group;
}
