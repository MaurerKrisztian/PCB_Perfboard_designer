import {Group, Vector3} from "three";
import {LEAD_TIP_Y, PITCH, SceneKit} from "../scene-kit";

export function buildHeaderPins(kit: SceneKit, rows: number, cols: number): Group {
  const group = new Group();
  const plastic = kit.blackPlasticMaterial;
  const gold = kit.standard("gold-pin", {color: "#e0b54a", metalness: 1, roughness: 0.28});
  const housingHeight = 2.5, pinTop = housingHeight + 6.0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const pinX = col * PITCH, pinZ = row * PITCH;
      group.add(kit.box(PITCH - 0.06, housingHeight, PITCH - 0.06, plastic, new Vector3(pinX, housingHeight / 2, pinZ)));
      group.add(kit.box(0.64, pinTop - LEAD_TIP_Y, 0.64, gold, new Vector3(pinX, (pinTop + LEAD_TIP_Y) / 2, pinZ)));
    }
  }
  return group;
}
