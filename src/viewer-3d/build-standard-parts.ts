import {
  CylinderGeometry, DoubleSide, ExtrudeGeometry, Group, LatheGeometry, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, Object3D, Shape, SphereGeometry, Vector2, Vector3,
} from "three";
import {LEAD_TIP_Y, paintedTexture, SceneKit, textPlane} from "./scene-kit";
import {ViewerStandardPart} from "./project-data";
import {formatComponentValue, parseComponentValue} from "../features/standard-components/component-value";
import {getCeramicCapacitorCode, getResistorBandColors} from "../features/standard-components/component-value-codes";

// Every two-lead part is modelled in a local frame where the start hole is the origin and the
// end hole lies on +x, then the frame is swung onto the real hole positions. So "-x side"
// below always means "toward the start dot", which is how the 2D artwork orients polarity.

// --- Axial parts (resistor, diode, inductor) ---

interface AxialSpec {
  length: number;
  radius: number;
  // Body radius as a fraction of `radius`, at fraction t (0..1) along the body.
  shape: (t: number) => number;
  material: MeshStandardMaterial;
  bands?: {at: number; width: number; color: string}[];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function axialRadius(spec: AxialSpec, t: number): number {
  // Round the ends off over the last ~40% of a radius so bodies don't end in flat discs.
  const fromEnd = Math.min(t, 1 - t) * spec.length;
  const capLength = spec.radius * 0.45;
  const cap = fromEnd >= capLength ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow(1 - fromEnd / capLength, 2)));
  return spec.radius * spec.shape(t) * cap;
}

function axialLathe(spec: AxialSpec, from: number, to: number, grow: number): LatheGeometry {
  const steps = Math.max(4, Math.round((to - from) * 60));
  const points: Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = from + (to - from) * i / steps;
    points.push(new Vector2(axialRadius(spec, t) + grow, t * spec.length));
  }
  return new LatheGeometry(points, 28);
}

/** The body of an axial part, standing along +y from y=0. */
function axialBody(kit: SceneKit, spec: AxialSpec): Group {
  const group = new Group();
  const body = new Mesh(axialLathe(spec, 0, 1, 0), spec.material);
  body.castShadow = true;
  group.add(body);
  for (const band of spec.bands ?? []) {
    const material = kit.standard(`band:${band.color}`, {color: band.color, roughness: 0.5});
    const ring = new Mesh(axialLathe(spec, band.at - band.width / 2, band.at + band.width / 2, 0.04), material);
    group.add(ring);
  }
  return group;
}

// Leave this much lead showing either side of a lying-down body before it has to stand up.
const AXIAL_MIN_LEAD = 1.0;

function buildAxial(kit: SceneKit, span: number, spec: AxialSpec): Group {
  const group = new Group();
  const body = axialBody(kit, spec);
  if (span >= spec.length + AXIAL_MIN_LEAD * 2) {
    // Lying flat between its holes, leads bent down at each end.
    const height = spec.radius + 0.35;
    const bodyStart = (span - spec.length) / 2;
    body.rotation.z = -Math.PI / 2;
    body.position.set(bodyStart, height, 0);
    group.add(body);
    group.add(kit.lead([new Vector3(0, LEAD_TIP_Y, 0), new Vector3(0, height, 0), new Vector3(bodyStart + 0.3, height, 0)]));
    group.add(kit.lead([new Vector3(span, LEAD_TIP_Y, 0), new Vector3(span, height, 0), new Vector3(bodyStart + spec.length - 0.3, height, 0)]));
  } else {
    // Too little room to lie down: stand on the start hole with the far lead looped back over.
    const bottom = 1.0;
    const top = bottom + spec.length;
    const loop = top + 0.9;
    body.position.set(0, bottom, 0);
    group.add(body);
    group.add(kit.lead([new Vector3(0, LEAD_TIP_Y, 0), new Vector3(0, bottom + 0.3, 0)]));
    group.add(kit.lead([new Vector3(0, top - 0.3, 0), new Vector3(0, loop, 0), new Vector3(span, loop, 0), new Vector3(span, LEAD_TIP_Y, 0)]));
  }
  return group;
}

// Band slots taken from resistor.svg (rect x 19.5/34.3/49/71.5, 5.6 wide, body spanning x≈5..95),
// so the 3D bands sit where the 2D ones do, digit 1 nearest the start dot.
const RESISTOR_BAND_AT = [0.192, 0.357, 0.52, 0.77];
const RESISTOR_PLAIN_BAND = "#2b2118";

function resistorShape(t: number): number {
  // Dog-bone: fat end caps, slimmer middle.
  const neck = smoothstep(0.2, 0.3, t) * (1 - smoothstep(0.7, 0.8, t));
  return 1 - 0.14 * neck;
}

function buildResistor(kit: SceneKit, span: number, value?: string): Group {
  const ohms = value ? parseComponentValue(value, "Ω") : undefined;
  const codes = ohms !== undefined && ohms > 0 ? getResistorBandColors(ohms) : undefined;
  const colors = codes
    ? [codes.digit1, codes.digit2, codes.multiplier, codes.tolerance]
    : RESISTOR_BAND_AT.map(() => RESISTOR_PLAIN_BAND);
  return buildAxial(kit, span, {
    length: 6.2, radius: 1.2, shape: resistorShape,
    material: kit.standard("resistor-body", {color: "#d6bd94", roughness: 0.6}),
    bands: RESISTOR_BAND_AT.map((at, i) => ({at, width: 0.08, color: colors[i]})),
  });
}

function buildDiode(kit: SceneKit, span: number): Group {
  // Cathode band near the end dot, as in diode.svg.
  return buildAxial(kit, span, {
    length: 4.4, radius: 1.1, shape: () => 1,
    material: kit.standard("diode-body", {color: "#2b2f34", roughness: 0.35}),
    bands: [{at: 0.84, width: 0.12, color: "#cfd4da"}],
  });
}

// The four coil bumps of inductor.svg (circles at x 24/41/58/75 on the same 5..95 body).
const INDUCTOR_BUMPS = [0.21, 0.4, 0.59, 0.78];

function buildInductor(kit: SceneKit, span: number): Group {
  return buildAxial(kit, span, {
    length: 6.6, radius: 1.45,
    shape: t => 0.84 + 0.16 * Math.max(...INDUCTOR_BUMPS.map(b => Math.max(0, 1 - Math.abs(t - b) / 0.085))),
    material: kit.standard("inductor-body", {color: "#3f3a34", roughness: 0.45}),
  });
}

// --- Radial parts: standing up between their two holes ---

/** Leads from both holes up to a body whose legs leave it `halfGap` either side of center. */
function radialLeads(kit: SceneKit, span: number, halfGap: number, contactY: number, extraRise = 0): Group {
  const group = new Group();
  const center = span / 2;
  const gap = Math.min(center, halfGap);
  const kneeY = Math.min(0.8, contactY);
  for (const [hole, contact] of [[0, center - gap], [span, center + gap]]) {
    const points = [new Vector3(hole, LEAD_TIP_Y, 0), new Vector3(hole, kneeY, 0), new Vector3(contact, contactY, 0)];
    if (extraRise > 0) points.push(new Vector3(contact, contactY + extraRise, 0));
    group.add(kit.lead(points));
  }
  return group;
}

function buildCeramicCapacitor(kit: SceneKit, span: number, value?: string): Group {
  const group = new Group();
  const radius = 2.5, thickness = 0.9;
  const centerY = 2.2 + radius;
  const disc = new Mesh(new SphereGeometry(1, 32, 20), kit.standard("ceramic-body", {color: "#d99a4e", roughness: 0.62}));
  disc.scale.set(radius, radius * 0.94, thickness);
  disc.position.set(span / 2, centerY, 0);
  disc.castShadow = true;
  group.add(disc);
  group.add(radialLeads(kit, span, 1.25, centerY - radius * 0.7));

  const farads = value ? parseComponentValue(value, "F") : undefined;
  const code = farads !== undefined && farads > 0 ? getCeramicCapacitorCode(farads) ?? value : value;
  if (code) {
    for (const side of [1, -1]) {
      const label = textPlane(code, 2.8, 1.5, "#3a2410");
      label.position.set(span / 2, centerY, side * (thickness + 0.005));
      if (side < 0) label.rotation.y = Math.PI;
      group.add(label);
    }
  }
  return group;
}

function buildElectrolyticCapacitor(kit: SceneKit, span: number, value?: string): Group {
  const group = new Group();
  const radius = 3.15, height = 11, bottom = 0.5;
  const cx = span / 2;

  // Sleeve profile: rounded bottom, crimp groove near the top, rolled top edge.
  const profile = [
    new Vector2(0, 0), new Vector2(radius - 0.35, 0), new Vector2(radius, 0.3),
    new Vector2(radius, height - 1.5), new Vector2(radius - 0.22, height - 1.15), new Vector2(radius, height - 0.8),
    new Vector2(radius, height - 0.3), new Vector2(radius - 0.3, height), new Vector2(0, height),
  ];
  const sleeveMaterial = kit.standard("electrolytic-sleeve", {color: "#34618f", roughness: 0.32});
  const can = new Mesh(new LatheGeometry(profile, 40), sleeveMaterial);
  can.position.set(cx, bottom, 0);
  can.castShadow = true;
  group.add(can);

  // Aluminium top with the pressure-vent scoring (the "Y" in electrolytic-capacitor.svg).
  const topTexture = paintedTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#c3c9d1";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#6b737d";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const angle of [-90, 30, 150]) {
      const a = angle * Math.PI / 180;
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(w / 2 + Math.cos(a) * w * 0.36, h / 2 + Math.sin(a) * h * 0.36);
    }
    ctx.stroke();
  });
  const top = new Mesh(new CylinderGeometry(radius - 0.3, radius - 0.3, 0.02, 40), [
    kit.standard("electrolytic-top-edge", {color: "#c3c9d1", metalness: 0.8, roughness: 0.35}),
    new MeshStandardMaterial({map: topTexture, metalness: 0.8, roughness: 0.35}),
    kit.standard("electrolytic-top-edge", {color: "#c3c9d1", metalness: 0.8, roughness: 0.35}),
  ]);
  top.position.set(cx, bottom + height + 0.005, 0);
  group.add(top);

  // Negative stripe on the start side (-x), as electrolytic-capacitor.svg draws it.
  const stripeHeight = height - 2.0;
  const stripeTexture = paintedTexture(64, 512, (ctx, w, h) => {
    ctx.fillStyle = "#dfe6ee";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#34618f";
    for (let y = h * 0.12; y < h * 0.95; y += h * 0.16) ctx.fillRect(w * 0.28, y, w * 0.44, h * 0.022);
  });
  const stripeWidth = 1.1;
  const stripe = new Mesh(
    new CylinderGeometry(radius + 0.03, radius + 0.03, stripeHeight, 12, 1, true, Math.PI * 1.5 - stripeWidth / 2, stripeWidth),
    new MeshStandardMaterial({map: stripeTexture, roughness: 0.32, side: DoubleSide}),
  );
  stripe.position.set(cx, bottom + 0.4 + stripeHeight / 2, 0);
  group.add(stripe);

  const farads = value ? parseComponentValue(value, "F") : undefined;
  const text = farads !== undefined ? formatComponentValue(farads, "F") : value;
  if (text) {
    // Printed running up the sleeve, on the side facing +z.
    const labelArc = 1.8 / radius; // 1.8mm of sleeve, in radians
    const labelTexture = paintedTexture(128, 640, (ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#e8eef5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${w * 0.62}px Inter, Arial, sans-serif`;
      ctx.fillText(text, 0, 0, h * 0.9);
    });
    const label = new Mesh(
      new CylinderGeometry(radius + 0.03, radius + 0.03, stripeHeight, 12, 1, true, -labelArc / 2, labelArc),
      new MeshStandardMaterial({map: labelTexture, transparent: true, roughness: 0.32, depthWrite: false}),
    );
    label.position.copy(stripe.position);
    group.add(label);
  }

  group.add(radialLeads(kit, span, 1.25, bottom + 0.2));
  return group;
}

const LED_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#facc15",
};

function buildLed(kit: SceneKit, span: number, color?: string): Group {
  const group = new Group();
  const cx = span / 2;
  const radius = 2.5, flangeRadius = 2.9, base = 2.2, flangeHeight = 1.0, straight = 5.1;

  // Flange with the flat cathode edge on the start side (-x), like led.svg's flat edge.
  const flatX = -2.5;
  const flatHalf = Math.sqrt(flangeRadius * flangeRadius - flatX * flatX);
  const arcFrom = Math.atan2(-flatHalf, flatX);
  const flange = new Shape();
  flange.moveTo(flatX, -flatHalf);
  flange.absarc(0, 0, flangeRadius, arcFrom, -arcFrom, false);
  flange.lineTo(flatX, -flatHalf);
  const flangeGeometry = new ExtrudeGeometry(flange, {depth: flangeHeight, bevelEnabled: false, curveSegments: 24});
  flangeGeometry.rotateX(-Math.PI / 2);

  const domeProfile: Vector2[] = [new Vector2(radius, 0), new Vector2(radius, straight)];
  for (let i = 1; i <= 10; i++) {
    const a = (i / 10) * Math.PI / 2;
    domeProfile.push(new Vector2(Math.cos(a) * radius, straight + Math.sin(a) * radius));
  }

  let material: MeshPhysicalMaterial;
  if (color === "rgb") {
    const stripes = paintedTexture(96, 8, (ctx, w, h) => {
      ["#ef4444", "#22c55e", "#3b82f6"].forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.fillRect(i * w / 3, 0, w / 3, h);
      });
    });
    material = new MeshPhysicalMaterial({map: stripes, emissiveMap: stripes, emissive: "#ffffff", emissiveIntensity: 0.3, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.85});
  } else if (color) {
    const tint = LED_COLORS[color] ?? color;
    material = new MeshPhysicalMaterial({color: tint, emissive: tint, emissiveIntensity: 0.3, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.8});
  } else {
    // No color picked: a water-clear 5mm LED.
    material = new MeshPhysicalMaterial({color: "#eef3f8", roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.45});
  }

  const flangeMesh = new Mesh(flangeGeometry, material);
  flangeMesh.position.set(cx, base, 0);
  const dome = new Mesh(new LatheGeometry(domeProfile, 40), material);
  dome.position.set(cx, base + flangeHeight, 0);
  for (const mesh of [flangeMesh, dome]) {
    mesh.castShadow = true;
    group.add(mesh);
  }

  // Leads continue up inside the epoxy to the anvil (cathode, start side) and post, which show
  // through the translucent body.
  group.add(radialLeads(kit, span, 1.27, base, 3.4));
  const gap = Math.min(cx, 1.27);
  const frame = kit.standard("led-frame", {color: "#bfc5cc", metalness: 1, roughness: 0.3});
  group.add(kit.box(1.5, 1.1, 0.4, frame, new Vector3(cx - gap + 0.35, base + 4.0, 0)));
  group.add(kit.box(0.6, 0.6, 0.4, frame, new Vector3(cx + gap - 0.1, base + 3.8, 0)));
  return group;
}

function buildUnknown(kit: SceneKit, span: number): Group {
  const group = new Group();
  group.add(kit.box(Math.max(2, span * 0.6), 2, 2, kit.blackPlasticMaterial, new Vector3(span / 2, 1.5, 0)));
  group.add(radialLeads(kit, span, Math.max(1, span * 0.3), 0.5));
  return group;
}

export function buildStandardPart(kit: SceneKit, part: ViewerStandardPart): Object3D | null {
  const {frame} = kit;
  const start = frame.point(part.startX, part.startY);
  const end = frame.point(part.endX, part.endY);
  const span = start.distanceTo(end);
  if (span < 0.01) return null;

  kit.solder(part.startX, part.startY);
  kit.solder(part.endX, part.endY);

  let group: Group;
  switch (part.definitionId) {
    case "resistor": group = buildResistor(kit, span, part.value); break;
    case "diode": group = buildDiode(kit, span); break;
    case "inductor": group = buildInductor(kit, span); break;
    case "ceramic-capacitor": group = buildCeramicCapacitor(kit, span, part.value); break;
    case "electrolytic-capacitor": group = buildElectrolyticCapacitor(kit, span, part.value); break;
    case "led": group = buildLed(kit, span, part.color); break;
    default: group = buildUnknown(kit, span);
  }
  group.position.copy(start);
  // Swing local +x onto the start->end direction (rotation about y maps +x to (cos θ, 0, -sin θ)).
  group.rotation.y = -Math.atan2(end.z - start.z, end.x - start.x);
  return group;
}
