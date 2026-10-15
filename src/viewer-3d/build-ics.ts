import {Group, Material, MeshStandardMaterial, Object3D, Vector3} from "three";
import {fitFont, LABEL_FONT, LEAD_TIP_Y, PITCH, paintedTexture, PX_PER_PITCH, SceneKit} from "./scene-kit";
import {ViewerIc} from "./project-data";
import {isModulePart} from "../project-file/ic-package";

type Side = "left" | "right" | "top" | "bottom";

interface IcPin {
  pin: number;
  // Canvas px (for the solder registry) and world mm (for geometry) of the same hole.
  px: number;
  py: number;
  x: number;
  z: number;
  side: Side;
}

// Same pin numbering as Ic.getRealPinPositions in the editor, so a pin's label and solder
// joint land on the hole the editor connects it to.
function icPins(kit: SceneKit, ic: ViewerIc): IcPin[] {
  const {frame} = kit;
  const pins: IcPin[] = [];
  const left = ic.left, top = ic.top;
  const right = left + PX_PER_PITCH * (ic.widthPin - 1);
  const bottom = top + PX_PER_PITCH * (ic.heightPin - 1);
  if (ic.rotationAngle === 0 || ic.rotationAngle === 180) {
    const n = ic.heightPin;
    for (let i = 0; i < n; i++) {
      const py = top + i * PX_PER_PITCH;
      const leftPin = ic.rotationAngle === 0 ? i + 1 : n * 2 - i;
      const rightPin = ic.rotationAngle === 0 ? n * 2 - i : i + 1;
      pins.push({pin: leftPin, px: left, py, x: frame.x(left), z: frame.z(py), side: "left"});
      pins.push({pin: rightPin, px: right, py, x: frame.x(right), z: frame.z(py), side: "right"});
    }
  } else {
    const n = ic.widthPin;
    for (let i = 0; i < n; i++) {
      const px = left + i * PX_PER_PITCH;
      const topPin = ic.rotationAngle === 90 ? i + 1 : n * 2 - i;
      const bottomPin = ic.rotationAngle === 90 ? n * 2 - i : i + 1;
      pins.push({pin: topPin, px, py: top, x: frame.x(px), z: frame.z(top), side: "top"});
      pins.push({pin: bottomPin, px, py: bottom, x: frame.x(px), z: frame.z(bottom), side: "bottom"});
    }
  }
  return pins;
}

// Where the editor draws the orientation notch and the pin-1 dot (Ic.drawBody), per rotation.
const NOTCH_EDGE: Record<number, Side> = {0: "top", 90: "right", 180: "bottom", 270: "left"};
const PIN1_CORNER: Record<number, [number, number]> = {0: [0, 0], 90: [1, 0], 180: [1, 1], 270: [0, 1]};

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

function pinLabel(pin: IcPin, ic: ViewerIc): string {
  const desc = ic.pinDescription[pin.pin];
  if (!desc) return String(pin.pin);
  return pin.side === "right" || pin.side === "bottom" ? `${desc}:${pin.pin}` : `${pin.pin}:${desc}`;
}

interface TopMarkings {
  background: string;
  text: string;
  labelColor: string;
  notchColor?: string;
  pads?: boolean;
  // Shift the name this fraction of the body's length away from the notch end (to clear
  // whatever sits mid-board on a module).
  nameShift?: number;
}

/** Paints the top face of a body: pin labels by each pin (as the 2D view prints them), the
 *  name along the long axis, and the orientation marks. Laid out in world x/z, which is how a
 *  BoxGeometry maps its +y face's UVs (u along +x, v=1 at -z). */
function paintTop(rect: Rect, ic: ViewerIc, pins: IcPin[], style: TopMarkings): MeshStandardMaterial {
  const width = rect.x1 - rect.x0, depth = rect.z1 - rect.z0;
  const ppm = Math.min(40, 2048 / Math.max(width, depth));
  const texture = paintedTexture(width * ppm, depth * ppm, (ctx, w, h) => {
    const toU = (x: number) => (x - rect.x0) * ppm;
    const toV = (z: number) => (z - rect.z0) * ppm;
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, w, h);

    if (style.pads) {
      // Plated header holes of a module board, with the pin tips poking through.
      for (const pin of pins) {
        ctx.fillStyle = "#d8b25a";
        ctx.beginPath();
        ctx.arc(toU(pin.x), toV(pin.z), 0.85 * ppm, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (style.notchColor) {
      const edge = NOTCH_EDGE[ic.rotationAngle];
      const [nu, nv] = edge === "top" ? [w / 2, 0] : edge === "bottom" ? [w / 2, h] : edge === "left" ? [0, h / 2] : [w, h / 2];
      ctx.fillStyle = style.notchColor;
      ctx.beginPath();
      ctx.arc(nu, nv, 1.0 * ppm, 0, Math.PI * 2);
      ctx.fill();
      const [cu, cv] = PIN1_CORNER[ic.rotationAngle];
      ctx.beginPath();
      ctx.arc(cu ? w - 1.1 * ppm : 1.1 * ppm, cv ? h - 1.1 * ppm : 1.1 * ppm, 0.45 * ppm, 0, Math.PI * 2);
      ctx.fill();
    }

    const fontSize = 0.6 * ppm;
    const pad = (style.pads ? 1.2 : 0.35) * ppm;
    ctx.fillStyle = style.labelColor;
    ctx.font = `600 ${fontSize}px ${LABEL_FONT}`;
    for (const pin of pins) {
      const label = pinLabel(pin, ic);
      const u = toU(pin.x), v = toV(pin.z);
      if (pin.side === "left" || pin.side === "right") {
        ctx.textBaseline = "middle";
        ctx.textAlign = pin.side === "left" ? "left" : "right";
        const x = pin.side === "left" ? Math.max(0, u) + pad : Math.min(w, u) - pad;
        ctx.fillText(label, x, v, w / 2 - pad * 1.5);
      } else {
        ctx.textAlign = "center";
        ctx.textBaseline = pin.side === "top" ? "top" : "bottom";
        const y = pin.side === "top" ? Math.max(0, v) + pad : Math.min(h, v) - pad;
        ctx.fillText(label, u, y, PITCH * ppm * 0.95);
      }
    }

    ctx.save();
    const shift = style.nameShift ?? 0;
    const away = NOTCH_EDGE[ic.rotationAngle];
    const [su, sv] = away === "top" ? [0, h] : away === "bottom" ? [0, -h] : away === "left" ? [w, 0] : [-w, 0];
    ctx.translate(w / 2 + su * shift, h / 2 + sv * shift);
    const tall = h > w;
    if (tall) ctx.rotate(-Math.PI / 2);
    const long = tall ? h : w, short = tall ? w : h;
    ctx.fillStyle = style.text;
    // A shifted name only has the space between mid-board and the far end to fill.
    fitFont(ctx, ic.name, long * (shift ? 0.9 - 2.2 * shift : 0.62), Math.min(short * 0.22, 2.2 * ppm), "700");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ic.name, 0, 0);
    ctx.restore();
  });
  return new MeshStandardMaterial({map: texture, roughness: style.pads ? 0.45 : 0.6});
}

function sideMaterials(side: Material, top: Material): Material[] {
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
  return [side, side, top, side, side, side];
}

/** Bounds of the pin lattice, in world mm. */
function pinBounds(pins: IcPin[]): Rect {
  const xs = pins.map(p => p.x), zs = pins.map(p => p.z);
  return {x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs)};
}

function buildDip(kit: SceneKit, ic: ViewerIc, pins: IcPin[]): Group {
  const group = new Group();
  const columns = ic.rotationAngle === 0 || ic.rotationAngle === 180;
  const lattice = pinBounds(pins);
  // Body sits between the two pin rows and runs half a pitch past the end pins.
  const inset = 0.95, minBody = 1.6, overhang = 1.15;
  const across = (lo: number, hi: number): [number, number] => {
    const mid = (lo + hi) / 2;
    const half = Math.max(minBody / 2, (hi - lo) / 2 - inset);
    return [mid - half, mid + half];
  };
  const [x0, x1] = columns ? across(lattice.x0, lattice.x1) : [lattice.x0 - overhang, lattice.x1 + overhang];
  const [z0, z1] = columns ? [lattice.z0 - overhang, lattice.z1 + overhang] : across(lattice.z0, lattice.z1);
  const rect = {x0, x1, z0, z1};

  const bodyBottom = 0.55, bodyHeight = 3.2;
  const epoxy = kit.standard("dip-epoxy", {color: "#1b1d20", roughness: 0.62});
  const top = paintTop(rect, ic, pins, {background: "#1b1d20", text: "#aab3bd", labelColor: "#7f8a96", notchColor: "#0c0d0f"});
  group.add(kit.box(x1 - x0, bodyHeight, z1 - z0, sideMaterials(epoxy, top), new Vector3((x0 + x1) / 2, bodyBottom + bodyHeight / 2, (z0 + z1) / 2)));

  // Gull-wing DIP legs: out of the body side, down past a wide shoulder, then the narrow pin.
  const shoulderY = 1.3, kneeY = 0.4, legThickness = 0.25;
  for (const pin of pins) {
    const lead = kit.leadMaterial;
    const outward = pin.side === "left" ? -1 : pin.side === "top" ? -1 : 1;
    if (pin.side === "left" || pin.side === "right") {
      const edge = outward < 0 ? x0 : x1;
      const reach = Math.abs(pin.x - edge) + legThickness / 2;
      group.add(kit.box(reach, legThickness, 1.1, lead, new Vector3((edge + pin.x) / 2 + outward * legThickness / 4, shoulderY, pin.z)));
      group.add(kit.box(legThickness, shoulderY - kneeY, 1.1, lead, new Vector3(pin.x, (shoulderY + kneeY) / 2, pin.z)));
      group.add(kit.box(legThickness, kneeY - LEAD_TIP_Y, 0.5, lead, new Vector3(pin.x, (kneeY + LEAD_TIP_Y) / 2, pin.z)));
    } else {
      const edge = outward < 0 ? z0 : z1;
      const reach = Math.abs(pin.z - edge) + legThickness / 2;
      group.add(kit.box(1.1, legThickness, reach, lead, new Vector3(pin.x, shoulderY, (edge + pin.z) / 2 + outward * legThickness / 4)));
      group.add(kit.box(1.1, shoulderY - kneeY, legThickness, lead, new Vector3(pin.x, (shoulderY + kneeY) / 2, pin.z)));
      group.add(kit.box(0.5, kneeY - LEAD_TIP_Y, legThickness, lead, new Vector3(pin.x, (kneeY + LEAD_TIP_Y) / 2, pin.z)));
    }
  }
  return group;
}

function buildModule(kit: SceneKit, ic: ViewerIc, pins: IcPin[]): Group {
  const group = new Group();
  const columns = ic.rotationAngle === 0 || ic.rotationAngle === 180;
  const lattice = pinBounds(pins);
  const acrossMargin = 1.3, alongMargin = 1.27, usbOverhang = 2.2;
  const notch = NOTCH_EDGE[ic.rotationAngle];
  const rect = columns
    ? {x0: lattice.x0 - acrossMargin, x1: lattice.x1 + acrossMargin, z0: lattice.z0 - alongMargin - (notch === "top" ? usbOverhang : 0), z1: lattice.z1 + alongMargin + (notch === "bottom" ? usbOverhang : 0)}
    : {x0: lattice.x0 - alongMargin - (notch === "left" ? usbOverhang : 0), x1: lattice.x1 + alongMargin + (notch === "right" ? usbOverhang : 0), z0: lattice.z0 - acrossMargin, z1: lattice.z1 + acrossMargin};

  // Male headers: plastic spacer on the perfboard, the module board resting on top of it.
  const spacer = 2.5, boardThickness = 1.6, boardBottom = spacer, boardTop = spacer + boardThickness;
  const plastic = kit.blackPlasticMaterial;
  const gold = kit.standard("gold-pin", {color: "#e0b54a", metalness: 1, roughness: 0.28});
  const solder = kit.standard("module-solder", {color: "#d7dbe0", metalness: 1, roughness: 0.22});
  for (const pin of pins) {
    group.add(kit.box(PITCH - 0.06, spacer, PITCH - 0.06, plastic, new Vector3(pin.x, spacer / 2, pin.z)));
    group.add(kit.box(0.64, boardTop + 1.1 - LEAD_TIP_Y, 0.64, gold, new Vector3(pin.x, (boardTop + 1.1 + LEAD_TIP_Y) / 2, pin.z)));
    const joint = kit.ball(new Vector3(pin.x, boardTop, pin.z), 0.8, solder);
    joint.scale.y = 0.45;
    group.add(joint);
  }

  const soldermask = kit.standard("module-pcb", {color: "#1f4fa3", roughness: 0.45});
  const top = paintTop(rect, ic, pins, {background: "#1f4fa3", text: "#f1f5f9", labelColor: "#e8eef6", pads: true, nameShift: 0.3});
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2;
  group.add(kit.box(rect.x1 - rect.x0, boardThickness, rect.z1 - rect.z0, sideMaterials(soldermask, top), new Vector3(cx, boardBottom + boardThickness / 2, cz)));

  // Main chip (QFP) mid-board, turned 45° like on a Nano.
  const chip = kit.box(7, 1.2, 7, kit.standard("qfp", {color: "#202327", roughness: 0.55}), new Vector3(cx, boardTop + 0.6, cz));
  chip.rotation.y = Math.PI / 4;
  group.add(chip);

  // USB connector overhanging the notch end.
  const metal = kit.standard("usb-shell", {color: "#c9cfd6", metalness: 1, roughness: 0.25});
  const usbWidth = 7.5, usbHeight = 2.7, usbLength = 9;
  const usbAlongCenter = (lo: number, hi: number, atLow: boolean) => atLow ? lo + usbLength / 2 - 1.0 : hi - usbLength / 2 + 1.0;
  if (notch === "top" || notch === "bottom") {
    group.add(kit.box(usbWidth, usbHeight, usbLength, metal, new Vector3(cx, boardTop + usbHeight / 2, usbAlongCenter(rect.z0, rect.z1, notch === "top"))));
  } else {
    group.add(kit.box(usbLength, usbHeight, usbWidth, metal, new Vector3(usbAlongCenter(rect.x0, rect.x1, notch === "left"), boardTop + usbHeight / 2, cz)));
  }
  return group;
}

export function buildIc(kit: SceneKit, ic: ViewerIc): Object3D | null {
  const pins = icPins(kit, ic);
  if (pins.length === 0) return null;
  for (const pin of pins) kit.solder(pin.px, pin.py);
  return isModulePart(ic.category, ic.name) ? buildModule(kit, ic, pins) : buildDip(kit, ic, pins);
}
