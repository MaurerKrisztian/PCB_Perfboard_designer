import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {SceneKit} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

// Low-profile 3.5 mm jack opening toward +x, like its 2D artwork.
export function buildAudioJack(kit: SceneKit, definition: AdvancedComponentDefinition): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const height = 5, axisY = 2.5;
  const hole = kit.standard("barrel-hole", {color: "#07080a", roughness: 0.9});
  group.add(kit.box(bounds.width, height, bounds.depth, kit.blackPlasticMaterial,
    new Vector3(bounds.centerX, height / 2, bounds.centerZ)));
  const along = (radius: number, length: number, centerX: number, material = kit.blackPlasticMaterial) => {
    const mesh = cylinder(radius, length, material, new Vector3(centerX, axisY, bounds.centerZ));
    mesh.rotation.z = Math.PI / 2;
    return mesh;
  };
  group.add(along(3, 1, bounds.right + 0.5));
  group.add(along(1.8, 0.1, bounds.right + 1.01, hole));
  addLeads(group, kit, definition.pinOffsets, 0.6, 0.8, 0.4);
  return group;
}
