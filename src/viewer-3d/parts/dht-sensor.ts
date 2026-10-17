import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {SceneKit, textPlane} from "../scene-kit";
import {addLeads, bodyBounds} from "./part-geometry";

// DHT11/DHT22: an upright plastic case with a vented front (+z) face.
export function buildDhtSensor(kit: SceneKit, definition: AdvancedComponentDefinition, color: string, height: number, name: string): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 1;
  const plastic = kit.standard(`dht-${color}`, {color, roughness: 0.6});
  const vent = kit.standard("dht-vent", {color: "#30353c", roughness: 0.8});
  group.add(kit.box(bounds.width, height, bounds.depth, plastic,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  const columns = Math.max(3, Math.floor(bounds.width / 2.4));
  const rows = Math.max(3, Math.floor(height * 0.55 / 2.4));
  for (let column = 0; column < columns; column++) {
    for (let row = 0; row < rows; row++) {
      const x = bounds.left + (column + 0.5) * bounds.width / columns;
      const y = bottom + height * 0.92 - (row + 0.5) * 2.4;
      group.add(kit.box(1.2, 1.5, 0.06, vent, new Vector3(x, y, bounds.front + 0.02)));
    }
  }
  const label = textPlane(name, bounds.width * 0.7, 1.8, "#4b5563");
  label.position.set(bounds.centerX, bottom + height * 0.2, bounds.front + 0.01);
  group.add(label);
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.5, 0.3);
  return group;
}
