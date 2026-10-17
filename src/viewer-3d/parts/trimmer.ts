import {Group, Vector3} from "three";
import {AdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {formatComponentValue, parseComponentValue} from "../../parts/component-value";
import {SceneKit, textPlane} from "../scene-kit";
import {addLeads, bodyBounds, cylinder} from "./part-geometry";

export function buildTrimmer(kit: SceneKit, definition: AdvancedComponentDefinition, value?: string): Group {
  const group = new Group();
  const bounds = bodyBounds(definition);
  const bottom = 0.5, height = 10;
  const plastic = kit.standard("trimmer-blue", {color: "#1c68b2", roughness: 0.45});
  const brass = kit.standard("trimmer-screw", {color: "#d8b664", metalness: 0.85, roughness: 0.35});
  group.add(kit.box(bounds.width, height, bounds.depth, plastic,
    new Vector3(bounds.centerX, bottom + height / 2, bounds.centerZ)));
  const screwX = bounds.left + Math.min(bounds.depth, bounds.width) * 0.52;
  const screwRadius = Math.min(bounds.depth * 0.38, 1.6);
  group.add(cylinder(screwRadius, 0.65, brass, new Vector3(screwX, bottom + height + 0.32, bounds.centerZ)));
  group.add(kit.box(screwRadius * 1.6, 0.04, 0.35, kit.blackPlasticMaterial,
    new Vector3(screwX, bottom + height + 0.66, bounds.centerZ)));
  const ohms = value ? parseComponentValue(value, "Ω") : undefined;
  const label = textPlane(ohms !== undefined ? formatComponentValue(ohms, "Ω") : value || "3296", bounds.width * 0.8, 1.7, "#e2e8f0");
  label.position.set(bounds.centerX, bottom + height * 0.65, bounds.front + 0.01);
  group.add(label);
  addLeads(group, kit, definition.pinOffsets, bottom + 0.2);
  return group;
}

