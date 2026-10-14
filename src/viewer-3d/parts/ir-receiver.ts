import {Group, Mesh, SphereGeometry, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds} from "./part-geometry";

// Standing receiver with its lens bulging from the front (+z) face.
export function buildIrReceiver(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 1.2, height = 6.95;
  const plastic = kit.standard("ir-receiver-body", {color: "#17191c", roughness: 0.35});
  const depth = bounds.depth - 1;
  const backZ = bounds.back;
  group.add(kit.box(bounds.width, height, depth, plastic,
    new Vector3(bounds.centerX, bottom + height / 2, backZ + depth / 2)));
  const lens = new Mesh(new SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), plastic);
  lens.rotation.x = Math.PI / 2;
  lens.scale.set(1.9, 1.1, 2.1);
  lens.position.set(bounds.centerX, bottom + height * 0.62, backZ + depth);
  lens.castShadow = true;
  group.add(lens);
  addLeads(group, kit, definition.pinOffsets, bottom + 0.3, 0.5, 0.4);
  return group;
}
