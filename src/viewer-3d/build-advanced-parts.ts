import {Group, Object3D} from "three";
import {PX_PER_PITCH, SceneKit} from "./scene-kit";
import {ViewerAdvancedPart} from "./project-data";
import {getAdvancedComponentDefinition} from "../features/advanced-components/advanced-component-definitions";
import {rotateOffset} from "../features/advanced-components/rotate-offset";
import {buildCatalogPart} from "./build-catalog-parts";
import {buildHeaderPins} from "./parts/header-pins";
import {buildPotentiometer} from "./parts/potentiometer";
import {buildTo220} from "./parts/to220";
import {buildTransistor} from "./parts/transistor";
import {buildUnknown} from "./parts/unknown";

// Parts are modelled in a local frame where the anchor pin is the origin and the definition's
// pin offsets (dx, dy) sit at (dx * PITCH, 0, dy * PITCH), then swung by the part's rotation -
// the same anchor + rotated-offset scheme the editor places them with.

export function buildAdvancedPart(kit: SceneKit, part: ViewerAdvancedPart): Object3D | null {
  const def = getAdvancedComponentDefinition(part.definitionId);
  const offsets = def?.gridSizable || part.definitionId === "header-pins"
    ? Array.from({length: part.rows * part.cols}, (_, i) => ({dx: i % part.cols, dy: Math.floor(i / part.cols)}))
    : def?.pinOffsets ?? [{dx: 0, dy: 0}];

  for (const {dx, dy} of offsets) {
    const rotated = rotateOffset(dx, dy, part.rotationAngle);
    kit.solder(part.anchorX + rotated.x * PX_PER_PITCH, part.anchorY + rotated.y * PX_PER_PITCH);
  }

  let group: Group;
  switch (part.definitionId) {
    case "transistor": group = buildTransistor(kit, part.value); break;
    case "mosfet": group = buildTo220(kit, part.value); break;
    case "regulator-7805": group = buildTo220(kit, part.value || "7805"); break;
    case "regulator-lm317": group = buildTo220(kit, part.value || "LM317"); break;
    case "potentiometer": group = buildPotentiometer(kit, part.value); break;
    case "header-pins": group = buildHeaderPins(kit, part.rows, part.cols); break;
    default: group = buildCatalogPart(kit, part, def, offsets) ?? buildUnknown(kit, offsets);
  }
  group.position.copy(kit.frame.point(part.anchorX, part.anchorY));
  // rotateOffset turns (1, 0) into (0, 1) at 90° - clockwise on the y-down canvas, which is a
  // negative turn about the scene's y axis.
  group.rotation.y = -part.rotationAngle * Math.PI / 180;
  return group;
}
