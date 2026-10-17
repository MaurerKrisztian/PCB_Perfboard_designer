import {Group, Object3D} from "three";
import {SceneKit} from "./scene-kit";
import {ViewerAdvancedPart} from "./project-data";
import {getAdvancedComponentDefinition} from "../parts/advanced-component-definitions";
import {advancedPartShape, advancedPinOffsets} from "../parts/part-geometry";
import {gridToPx, toGridPos} from "../project-file/grid";
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
  // In the part's own frame, for modelling it; the board places the solder joints.
  const offsets = def ? advancedPinOffsets(def, part.rows, part.cols) : [{dx: 0, dy: 0}];

  if (def) {
    const at = toGridPos({x: part.anchorX, y: part.anchorY});
    const shape = advancedPartShape(def, {at, rotation: part.rotationAngle, rows: part.rows, cols: part.cols});
    for (const pin of shape.pins) kit.solder(gridToPx(pin.x), gridToPx(pin.y));
  } else {
    kit.solder(part.anchorX, part.anchorY);
  }

  let group: Group;
  switch (part.definitionId) {
    case "transistor": group = buildTransistor(kit, part.value); break;
    case "mosfet": group = buildTo220(kit, part.value); break;
    case "regulator-7805": group = buildTo220(kit, part.value || "7805"); break;
    case "regulator-lm317": group = buildTo220(kit, part.value || "LM317"); break;
    case "ds18b20": group = buildTransistor(kit, part.value || "DS18B20"); break;
    case "potentiometer": group = buildPotentiometer(kit, part.value); break;
    case "header-pins": group = buildHeaderPins(kit, part.rows, part.cols); break;
    default: group = buildCatalogPart(kit, part, def, offsets) ?? buildUnknown(kit, offsets);
  }
  group.position.copy(kit.frame.point(part.anchorX, part.anchorY));
  // A rotation turns (1, 0) into (0, 1) at 90° (see rotateOffset) - clockwise on the y-down
  // canvas, which is a negative turn about the scene's y axis.
  group.rotation.y = -part.rotationAngle * Math.PI / 180;
  return group;
}
