import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {PITCH, SceneKit} from "../scene-kit";
import {addLeads, addTopLabel, bodyBounds, cylinder} from "./part-geometry";

// Open CR2032 holder: a round base with the cell held down by a spring clip on the + side.
export function buildCoinCellHolder(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const baseHeight = 2.2, cellHeight = 3.2;
  const cellX = bounds.centerX + 0.4;
  const cell = kit.standard("coin-cell", {color: "#c3c9d0", metalness: 0.95, roughness: 0.28});
  const clip = kit.standard("coin-clip", {color: "#d8dde3", metalness: 0.9, roughness: 0.3});
  group.add(cylinder(Math.min(bounds.width, bounds.depth) / 2, baseHeight, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, baseHeight / 2, bounds.centerZ)));
  group.add(cylinder(10, cellHeight, cell, new Vector3(cellX, baseHeight + cellHeight / 2, bounds.centerZ)));
  addTopLabel(group, "CR2032 +", 11, 2.6, new Vector3(cellX, baseHeight + cellHeight + 0.01, bounds.centerZ), "#5b6570");
  const plus = definition.pinOffsets[0];
  const clipStart = plus.dx * PITCH;
  group.add(kit.box(8, 0.4, 4, clip, new Vector3(clipStart + 3.2, baseHeight + cellHeight + 0.25, bounds.centerZ)));
  group.add(kit.box(0.4, baseHeight + cellHeight, 4, clip, new Vector3(clipStart - 0.6, (baseHeight + cellHeight) / 2, bounds.centerZ)));
  addLeads(group, kit, definition.pinOffsets, baseHeight * 0.5, 0.6, 0.4);
  return group;
}
