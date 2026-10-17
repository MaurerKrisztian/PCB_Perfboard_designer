import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {LEAD_TIP_Y, PITCH, SceneKit, textPlane} from "../scene-kit";
import {bodyBounds} from "./part-geometry";

export function buildCeramicResonator(kit: SceneKit, definition: AdvancedComponentDefinition, value?: string): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 1, height = 5.5;
  const ceramic = kit.standard("resonator-orange", {color: "#d78736", roughness: 0.6});
  group.add(kit.box(bounds.width, height, bounds.depth, ceramic,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  const label = textPlane(value || "4.00", bounds.width * 0.8, 1.6, "#47321c");
  label.position.set(bounds.centerX, bottom + height * 0.6, bounds.front + 0.01);
  group.add(label);
  definition.pinOffsets.forEach((offset, index) => {
    group.add(kit.lead([
      new Vector3(offset.dx * PITCH, LEAD_TIP_Y, offset.dy * PITCH),
      new Vector3(offset.dx * PITCH, 0.2, offset.dy * PITCH),
      new Vector3(bounds.centerX + (index - 1) * 2.5, bottom + 0.2, bounds.centerZ),
    ]));
  });
  return group;
}
