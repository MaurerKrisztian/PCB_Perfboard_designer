import {Group, Mesh, SphereGeometry, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

export function buildThermistor(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const centerY = 4.5;
  const coating = kit.standard("thermistor-coating", {color: "#737980", roughness: 0.62});
  const body = new Mesh(new SphereGeometry(1, 32, 20), coating);
  body.scale.set(bounds.width / 2, 2.5, bounds.depth / 2);
  body.position.set(bounds.centerX, centerY, bounds.centerZ);
  body.castShadow = true;
  group.add(body);
  const marker = cylinder(0.38, 0.04, kit.standard("thermistor-dot", {color: "#2183c2", roughness: 0.5}),
    new Vector3(bounds.centerX, centerY + 0.55, bounds.front - 0.01));
  marker.rotation.x = Math.PI / 2;
  group.add(marker);
  addLeads(group, kit, definition.pinOffsets, centerY - 1.3, 0.5, 0.4);
  return group;
}
