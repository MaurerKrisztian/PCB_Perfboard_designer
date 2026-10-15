import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../features/advanced-components/advanced-component-definitions";
import {formatComponentValue, parseComponentValue} from "../../features/standard-components/component-value";
import {LEAD_TIP_Y, PITCH, SceneKit, textPlane} from "../scene-kit";
import {addTopLabel, bodyBounds} from "./part-geometry";

export function buildFilmCapacitor(kit: SceneKit, definition: AdvancedComponentDefinition, value?: string): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 1, height = 6.5;
  const coating = kit.standard("film-capacitor-red", {color: "#b62a32", roughness: 0.5});
  group.add(kit.box(bounds.width, height, bounds.depth, coating,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  const farads = value ? parseComponentValue(value, "F") : undefined;
  const marking = farads !== undefined ? formatComponentValue(farads, "F") : value || "MKS 2";
  const label = textPlane(marking, bounds.width * 0.84, 1.5, "#f0d9b1");
  label.position.set(bounds.centerX, bottom + height * 0.58, bounds.front + 0.01);
  group.add(label);
  addTopLabel(group, "WIMA", bounds.width * 0.8, 1.3,
    new Vector3(bounds.centerX, bottom + height + 0.01, bounds.centerZ), "#f0d9b1");
  definition.pinOffsets.forEach((offset, index) => {
    group.add(kit.lead([
      new Vector3(offset.dx * PITCH, LEAD_TIP_Y, offset.dy * PITCH),
      new Vector3(offset.dx * PITCH, 0.2, offset.dy * PITCH),
      new Vector3(bounds.centerX + (index === 0 ? -2.5 : 2.5), bottom + 0.2, bounds.centerZ),
    ]));
  });
  return group;
}
