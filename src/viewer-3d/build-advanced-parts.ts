import {CylinderGeometry, ExtrudeGeometry, Group, Mesh, Object3D, Path, Shape, Vector3} from "three";
import {LEAD_TIP_Y, PITCH, PX_PER_PITCH, SceneKit, textPlane} from "./scene-kit";
import {ViewerAdvancedPart} from "./project-data";
import {getAdvancedComponentDefinition} from "../features/advanced-components/advanced-component-definitions";
import {rotateOffset} from "../features/advanced-components/rotate-offset";
import {formatComponentValue, parseComponentValue} from "../features/standard-components/component-value";

// Parts are modelled in a local frame where the anchor pin is the origin and the definition's
// pin offsets (dx, dy) sit at (dx * PITCH, 0, dy * PITCH), then swung by the part's rotation -
// the same anchor + rotated-offset scheme the editor places them with.

function pinX(dx: number): number {
  return dx * PITCH;
}

function straightLeads(kit: SceneKit, xs: number[], topY: number, width = 0.6, thickness = 0.4): Group {
  const group = new Group();
  for (const x of xs) {
    group.add(kit.box(width, topY - LEAD_TIP_Y, thickness, kit.leadMaterial, new Vector3(x, (topY + LEAD_TIP_Y) / 2, 0)));
  }
  return group;
}

function buildTransistor(kit: SceneKit, value?: string): Group {
  const group = new Group();
  // TO-92: a D-shaped body over the middle pin, flat face toward +dy as in transistor.svg.
  const radius = 2.4, flatOffset = 1.4, height = 4.6, bottom = 2.8;
  const chordHalf = Math.sqrt(radius * radius - flatOffset * flatOffset);
  const arcFrom = Math.atan2(-flatOffset, chordHalf);
  const shape = new Shape();
  shape.moveTo(-chordHalf, -flatOffset);
  shape.lineTo(chordHalf, -flatOffset);
  shape.absarc(0, 0, radius, arcFrom, Math.PI - arcFrom, false);
  const geometry = new ExtrudeGeometry(shape, {depth: height, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 2, curveSegments: 24});
  // Extruded along +z; stand it up so the flat (shape y = -flatOffset) faces +z.
  geometry.rotateX(-Math.PI / 2);
  const body = new Mesh(geometry, kit.standard("to92-body", {color: "#2b2f34", roughness: 0.5}));
  body.position.set(pinX(1), bottom, 0);
  body.castShadow = true;
  group.add(body);

  // Outer legs splay in from their holes to the body's 1.27mm lead spacing.
  for (let i = 0; i < 3; i++) {
    const contact = pinX(1) + (i - 1) * 1.27;
    group.add(kit.lead([new Vector3(pinX(i), LEAD_TIP_Y, 0), new Vector3(pinX(i), 1.2, 0), new Vector3(contact, bottom, 0), new Vector3(contact, bottom + 0.4, 0)]));
  }
  if (value) {
    const label = textPlane(value, chordHalf * 1.8, 1.1, "#c7ced6");
    label.position.set(pinX(1), bottom + height * 0.62, flatOffset + 0.13);
    group.add(label);
  }
  return group;
}

function buildMosfet(kit: SceneKit, value?: string): Group {
  const group = new Group();
  // TO-220 standing upright: plastic body in front, metal tab (with its mounting hole) behind
  // and above it - mosfet.svg draws the tab on the -dy side.
  const width = 10, plasticHeight = 9.2, thickness = 4.5, bottom = 3.5;
  const cx = pinX(1);
  const plasticTop = bottom + plasticHeight;
  // Like the real package, the metal tab is the whole back plate and the plastic is molded onto
  // its front. The two must never share a face: coplanar faces z-fight (the plastic flickers
  // through the metal), so the plate is a hair narrower and the plastic's back sits inside it.
  const tabThickness = 1.3, tabWidth = width - 0.2;
  const back = -thickness / 2;
  const plasticBack = back + tabThickness / 2;
  group.add(kit.box(
    width, plasticHeight, thickness / 2 - plasticBack,
    kit.standard("to220-body", {color: "#26292d", roughness: 0.5}),
    new Vector3(cx, bottom + plasticHeight / 2, (plasticBack + thickness / 2) / 2),
  ));

  const tabBottom = bottom + 0.8, tabHeight = plasticTop + 6.5 - tabBottom;
  const tab = new Shape();
  tab.moveTo(-tabWidth / 2, 0);
  tab.lineTo(tabWidth / 2, 0);
  tab.lineTo(tabWidth / 2, tabHeight - 0.8);
  tab.lineTo(tabWidth / 2 - 0.8, tabHeight);
  tab.lineTo(-tabWidth / 2 + 0.8, tabHeight);
  tab.lineTo(-tabWidth / 2, tabHeight - 0.8);
  tab.lineTo(-tabWidth / 2, 0);
  const hole = new Path();
  hole.absarc(0, tabHeight - 3.2, 1.8, 0, Math.PI * 2, true);
  tab.holes.push(hole);
  const tabMesh = new Mesh(
    new ExtrudeGeometry(tab, {depth: tabThickness, bevelEnabled: false, curveSegments: 24}),
    kit.standard("to220-tab", {color: "#b9c2cc", metalness: 1, roughness: 0.28}),
  );
  tabMesh.position.set(cx, tabBottom, back);
  tabMesh.castShadow = true;
  group.add(tabMesh);

  group.add(straightLeads(kit, [pinX(0), pinX(1), pinX(2)], bottom + 0.3, 0.8, 0.5));
  if (value) {
    const label = textPlane(value, width * 0.8, 1.6, "#c7ced6");
    label.position.set(cx, bottom + plasticHeight * 0.55, thickness / 2 + 0.01);
    group.add(label);
  }
  return group;
}

function buildPotentiometer(kit: SceneKit, value?: string): Group {
  const group = new Group();
  // Matches the 2D footprint: a 5-hole flange body (pins on its front edge, at holes 1/3/5)
  // with the bushing and shaft sticking out toward +dy over the 3-hole tab.
  const left = pinX(-0.3), right = pinX(4.3), back = pinX(-1.3), front = pinX(0.3);
  const bottom = 0.6, height = 12;
  const cx = (left + right) / 2;
  const axisY = bottom + height / 2;
  const bodyMaterial = kit.standard("pot-body", {color: "#2d3138", roughness: 0.55});
  const metal = kit.standard("pot-metal", {color: "#c4cad2", metalness: 1, roughness: 0.3});
  group.add(kit.box(right - left, height, front - back, bodyMaterial, new Vector3(cx, bottom + height / 2, (front + back) / 2)));

  // Round metal cover on the front face, then the threaded bushing and the shaft.
  const along = (radius: number, length: number, z0: number, segments = 40) => {
    const mesh = new Mesh(new CylinderGeometry(radius, radius, length, segments), metal);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(cx, axisY, z0 + length / 2);
    mesh.castShadow = true;
    return mesh;
  };
  group.add(along(5.6, 0.5, front));
  const bushingEnd = pinX(2.3);
  group.add(along(3.4, bushingEnd - front - 0.5, front + 0.5, 28));
  const shaftLength = 7;
  const shaft = along(3.0, shaftLength, bushingEnd, 36);
  shaft.material = kit.standard("pot-shaft", {color: "#dfe3e8", metalness: 0.9, roughness: 0.45});
  group.add(shaft);
  // Screwdriver slot across the shaft's end.
  group.add(kit.box(6.0, 0.7, 0.6, kit.blackPlasticMaterial, new Vector3(cx, axisY, bushingEnd + shaftLength + 0.01)));

  group.add(straightLeads(kit, [pinX(0), pinX(2), pinX(4)], bottom + 0.2, 1.0, 0.4));
  const ohms = value ? parseComponentValue(value, "Ω") : undefined;
  const text = ohms !== undefined ? formatComponentValue(ohms, "Ω") : value;
  if (text) {
    const label = textPlane(text, (right - left) * 0.7, 2.2, "#e2e8f0");
    label.rotation.x = -Math.PI / 2;
    label.position.set(cx, bottom + height + 0.01, (front + back) / 2);
    group.add(label);
  }
  return group;
}

function buildHeaderPins(kit: SceneKit, rows: number, cols: number): Group {
  const group = new Group();
  const plastic = kit.blackPlasticMaterial;
  const gold = kit.standard("gold-pin", {color: "#e0b54a", metalness: 1, roughness: 0.28});
  const housingHeight = 2.5, pinTop = housingHeight + 6.0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = pinX(col), z = pinX(row);
      // Each pin's own housing block, with a hairline gap so the strip reads as segmented.
      group.add(kit.box(PITCH - 0.06, housingHeight, PITCH - 0.06, plastic, new Vector3(x, housingHeight / 2, z)));
      group.add(kit.box(0.64, pinTop - LEAD_TIP_Y, 0.64, gold, new Vector3(x, (pinTop + LEAD_TIP_Y) / 2, z)));
    }
  }
  return group;
}

function buildUnknown(kit: SceneKit, offsets: {dx: number; dy: number}[]): Group {
  const group = new Group();
  const xs = offsets.map(o => pinX(o.dx)), zs = offsets.map(o => pinX(o.dy));
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  group.add(kit.box(maxX - minX + 2, 3, maxZ - minZ + 2, kit.blackPlasticMaterial, new Vector3((minX + maxX) / 2, 2.5, (minZ + maxZ) / 2)));
  for (const o of offsets) {
    group.add(kit.lead([new Vector3(pinX(o.dx), LEAD_TIP_Y, pinX(o.dy)), new Vector3(pinX(o.dx), 1.2, pinX(o.dy))]));
  }
  return group;
}

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
    case "mosfet": group = buildMosfet(kit, part.value); break;
    case "potentiometer": group = buildPotentiometer(kit, part.value); break;
    case "header-pins": group = buildHeaderPins(kit, part.rows, part.cols); break;
    default: group = buildUnknown(kit, offsets);
  }
  group.position.copy(kit.frame.point(part.anchorX, part.anchorY));
  // rotateOffset turns (1, 0) into (0, 1) at 90° - clockwise on the y-down canvas, which is a
  // negative turn about the scene's y axis.
  group.rotation.y = -part.rotationAngle * Math.PI / 180;
  return group;
}
