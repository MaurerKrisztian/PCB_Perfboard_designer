import {CylinderGeometry, Group, Mesh, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

// Miniature toggle switch: metal-capped body, threaded M6 bushing with a hex nut, and the lever
// thrown toward +x.
export function buildToggleSwitch(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.6, height = 9.5, top = bottom + height;
  const metal = kit.standard("toggle-metal", {color: "#c4cad2", metalness: 0.95, roughness: 0.3});
  group.add(kit.box(bounds.width, height - 1, bounds.depth, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, bottom + (height - 1) / 2, bounds.centerZ)));
  group.add(kit.box(bounds.width, 1, bounds.depth, metal, new Vector3(bounds.centerX, top - 0.5, bounds.centerZ)));
  group.add(cylinder(3, 7, metal, new Vector3(bounds.centerX, top + 3.5, bounds.centerZ)));
  const nut = new Mesh(new CylinderGeometry(4.6, 4.6, 1.8, 6), metal);
  nut.position.set(bounds.centerX, top + 2.2, bounds.centerZ);
  nut.castShadow = true;
  group.add(nut);
  const pivot = new Vector3(bounds.centerX, top + 6.5, bounds.centerZ);
  const tip = new Vector3(bounds.centerX + 3.6, top + 15, bounds.centerZ);
  const lever = kit.rod(pivot, tip, 1.1, metal);
  if (lever) group.add(lever);
  group.add(kit.ball(tip, 1.4, metal));
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.8, 0.5);
  return group;
}
