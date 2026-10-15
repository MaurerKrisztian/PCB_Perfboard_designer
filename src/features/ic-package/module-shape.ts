// Top view of an Arduino Nano style dev board: two rows of plated pin holes, the microcontroller,
// reset button, status LEDs, a crystal, a few passives and a USB-C socket. Drawn from the pin
// count and width alone, so any size works. No silkscreen. Pure drawing code (no editor state):
// the editor paints it on the canvas and the catalog buttons use the SVG, both from the same
// geometry. Sizes are canvas px at a 50px pitch (2.54mm).
//
// The shape is laid out "upright": pin 1 top left, pins down the left side and back up the
// right side (like a DIP), the USB socket at the top end, beside pin 1 as on a real Nano. A rotation then turns the whole
// thing about the grid, so pin 1 and the socket follow.

const PITCH = 50;
// The board runs this far past the pin columns and past the first and last pin.
export const MODULE_EDGE = 16;
export const MODULE_END = 22;
const PAD_RADIUS = 10.5;
const HOLE_RADIUS = 4.5;
// A micro/mini-USB socket is about 7.5mm wide, i.e. 150px at this pitch.
const USB_WIDTH = 150;
const USB_ASPECT = 0.56;
const USB_OVERHANG = 8;

type Rotation = 0 | 90 | 180 | 270;

const BOARD_FILL = "#184a8c";
const BOARD_EDGE_COLOR = "#0e2d57";
const LED_TINTS = ["#ffb35c", "#ff8a5c", "#7be28a", "#ff6b6b"];

// Part sizes below are written for a board whose free width is 150 and scaled by k from there,
// so a wide board gets proportionally bigger parts. A part that doesn't fit is left out.
type SmallKind = "resistor" | "cap" | "regulator";
const SMALL: Record<SmallKind, [number, number]> = {resistor: [14, 8], cap: [10, 6], regulator: [26, 14]};

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Part extends Rect {
  kind: SmallKind | "led" | "button" | "crystal";
  s: number; // scale from the part's base size
  tint?: string;
}

interface Pad {
  x: number;
  y: number;
  first: boolean;
}

interface ModuleShape {
  board: Rect;
  pads: Pad[];
  usb: Rect | null;
  chip: Rect | null;
  parts: Part[];
  width: number; // upright footprint between the pin columns
  height: number;
}

function moduleShape(pinsPerRow: number, spanHoles: number): ModuleShape {
  const span = spanHoles * PITCH;
  const height = PITCH * (pinsPerRow - 1);
  const board = {x: -MODULE_EDGE, y: -MODULE_END, w: span + 2 * MODULE_EDGE, h: height + 2 * MODULE_END};

  const pads: Pad[] = [];
  for (let i = 0; i < pinsPerRow; i++) {
    pads.push({x: 0, y: i * PITCH, first: i === 0});
    pads.push({x: span, y: i * PITCH, first: false});
  }

  // Free area between the pad columns.
  const ix0 = PAD_RADIUS + 5;
  const ix1 = span - PAD_RADIUS - 5;
  const iw = ix1 - ix0;
  const k = Math.min(2.6, Math.max(0.5, iw / 150));
  const at = (f: number) => ix0 + iw * f;
  let top = -MODULE_END + 8;
  let bottom = height + MODULE_END - 8;

  const parts: Part[] = [];
  const add = (kind: Part["kind"], x: number, y: number, bw: number, bh: number, tint?: string) => {
    parts.push({kind, x, y, w: bw * k, h: bh * k, s: k, tint});
  };
  // A row of small parts, centred across the free width, as many as fit.
  const row = (kinds: SmallKind[], cy: number) => {
    const gap = 8 * k;
    let used = 0;
    let n = 0;
    for (const kind of kinds) {
      const next = used + SMALL[kind][0] * k + (n ? gap : 0);
      if (next > iw) break;
      used = next;
      n++;
    }
    let x = ix0 + (iw - used) / 2;
    for (let i = 0; i < n; i++) {
      const [bw, bh] = SMALL[kinds[i]];
      add(kinds[i], x, cy - (bh * k) / 2, bw, bh);
      x += bw * k + gap;
    }
  };

  // USB socket at the far end, its front edge a little past the board. Sockets are one real-world
  // size whatever the board, so it only shrinks when the board is too narrow to hold it.
  let usb: Rect | null = null;
  const usbW = Math.min(USB_WIDTH, iw);
  const usbH = Math.round(usbW * USB_ASPECT);
  if (iw >= 44 && board.h >= usbH + 120) {
    usb = {x: at(0.5) - usbW / 2, y: height + MODULE_END + USB_OVERHANG - usbH, w: usbW, h: usbH};
    bottom = usb.y - 8 * k;
  }

  // A pair of resistors just above it.
  if (iw >= 70 && bottom - top >= 160 * k) {
    const [w, h] = SMALL.resistor;
    const y = bottom - h * k;
    add("resistor", at(0.06), y, w, h);
    add("resistor", ix1 - iw * 0.06 - w * k, y, w, h);
    bottom = y - 10 * k;
  }

  // Four LEDs and the reset button at the top end, centred.
  if (iw >= 70 && bottom - top >= 76 * k + 60 * k) {
    const lw = 10;
    const lh = 20;
    const gap = 10;
    const groupW = (4 * lw + 3 * gap) * k;
    const gx = Math.min(ix1 - groupW, Math.max(ix0, at(0.5) - groupW / 2));
    const ly = top + 4 * k;
    for (let i = 0; i < 4; i++) add("led", gx + i * (lw + gap) * k, ly, lw, lh, LED_TINTS[i]);
    const by = ly + lh * k + 14 * k;
    const bx = Math.min(ix1 - 62 * k, Math.max(ix0, at(0.5) - 31 * k));
    add("button", bx, by, 62, 24);
    top = by + 24 * k + 12 * k;
  }

  // The microcontroller, centred and a little low, with the crystal above its left corner.
  let chip: Rect | null = null;
  const room = bottom - top;
  if (iw >= 26 && room >= 30) {
    const w = Math.min(iw * 0.67, room);
    chip = {x: at(0.5) - w / 2, y: top + (room - w) * 0.6, w, h: w};
    let free = chip.y - top;
    if (iw >= 70 && free >= 40 * k) {
      add("crystal", chip.x, chip.y - 34 * k, 13, 28);
      free = chip.y - 34 * k - top - 6 * k;
    } else {
      free -= 6 * k;
    }
    // On a long board there is room for passives above and below the chip.
    const kinds: SmallKind[][] = [
      ["regulator", "cap", "cap"], ["cap", "cap", "resistor", "cap"], ["resistor", "cap", "cap"], ["cap", "resistor"],
    ];
    const rowsAbove = Math.min(4, Math.max(0, Math.floor((free - 40 * k) / (18 * k))));
    for (let i = 0; i < rowsAbove; i++) row(kinds[i], top + (free / rowsAbove) * (i + 0.5));
    const below = bottom - (chip.y + chip.h) - 6 * k;
    const rowsBelow = Math.min(2, Math.max(0, Math.floor((below - 40 * k) / (18 * k))));
    for (let i = 0; i < rowsBelow; i++) row(kinds[(i + 1) % 4], chip.y + chip.h + 6 * k + (below / rowsBelow) * (i + 0.5));
  }
  // Everything above was laid out with the socket at the bottom; turn it over so it sits at pin 1's end.
  const flip = <T extends Rect>(r: T): T => ({...r, y: height - r.y - r.h});
  return {
    board, pads,
    usb: usb && flip(usb),
    chip: chip && flip(chip),
    parts: parts.map(flip),
    width: span,
    height,
  };
}

// Where the upright shape's origin (pin 1) lands once turned, and the turn to apply.
function placement(rotation: Rotation, shape: ModuleShape): {tx: number; ty: number; angle: number} {
  switch (rotation) {
    case 90: return {tx: shape.height, ty: 0, angle: Math.PI / 2};
    case 180: return {tx: shape.width, ty: shape.height, angle: Math.PI};
    case 270: return {tx: 0, ty: shape.width, angle: -Math.PI / 2};
    default: return {tx: 0, ty: 0, angle: 0};
  }
}

const isSideways = (rotation: Rotation) => rotation === 90 || rotation === 270;

// ctx.roundRect isn't in this project's TypeScript lib, so the corners are done with arcTo.
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function metalGradient(ctx: CanvasRenderingContext2D, x: number, w: number): CanvasGradient {
  const metal = ctx.createLinearGradient(x, 0, x + w, 0);
  metal.addColorStop(0, "#d8dde2");
  metal.addColorStop(0.5, "#aeb6bd");
  metal.addColorStop(1, "#8f98a1");
  return metal;
}

// A USB-C socket seen from above: a flat metal top with the shield legs at the rear sides. The
// mouth faces outward past the board edge, so it is not visible from this angle.
function drawUsb(ctx: CanvasRenderingContext2D, usb: Rect) {
  const {x, y, w, h} = usb;
  const r = Math.min(8, h / 2.5);
  ctx.fillStyle = "#8f98a1";
  ctx.fillRect(x - 3, y + h * 0.12, 6, h * 0.3);
  ctx.fillRect(x + w - 3, y + h * 0.12, 6, h * 0.3);
  ctx.beginPath();
  roundedRect(ctx, x, y, w, h, r);
  const metal = ctx.createLinearGradient(x, y, x + w, y + h);
  metal.addColorStop(0, "#dfe3e7");
  metal.addColorStop(0.5, "#b4bcc4");
  metal.addColorStop(1, "#98a1aa");
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#6f7a84";
  ctx.stroke();
  // The folded seam of the shell, and a faint rim just inside the edge.
  ctx.beginPath();
  roundedRect(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3));
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 4, y + h * 0.38);
  ctx.lineTo(x + w - 4, y + h * 0.38);
  ctx.strokeStyle = "rgba(60,70,80,0.5)";
  ctx.stroke();
}

// Square chip with eight legs along each side and a pin 1 dot.
function drawMcu(ctx: CanvasRenderingContext2D, chip: Rect) {
  const b = chip.w * 0.075;
  const legW = chip.w * 0.03;
  const usable = chip.w * 0.72;
  const start = (chip.w - usable) / 2;
  const pitch = usable / 8;
  ctx.fillStyle = "#aeb6bd";
  for (let i = 0; i < 8; i++) {
    const o = start + pitch * (i + 0.5) - legW / 2;
    ctx.fillRect(chip.x + o, chip.y, legW, b + 1);
    ctx.fillRect(chip.x + o, chip.y + chip.h - b - 1, legW, b + 1);
    ctx.fillRect(chip.x, chip.y + o, b + 1, legW);
    ctx.fillRect(chip.x + chip.w - b - 1, chip.y + o, b + 1, legW);
  }
  ctx.beginPath();
  roundedRect(ctx, chip.x + b, chip.y + b, chip.w - 2 * b, chip.h - 2 * b, 2.5);
  ctx.fillStyle = "#23272c";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#0d0f11";
  ctx.stroke();
  const sheen = ctx.createLinearGradient(chip.x, chip.y, chip.x + chip.w, chip.y + chip.h);
  sheen.addColorStop(0, "rgba(255,255,255,0.14)");
  sheen.addColorStop(0.6, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(chip.x + b, chip.y + b, chip.w - 2 * b, chip.h - 2 * b);
  ctx.beginPath();
  ctx.arc(chip.x + b + chip.w * 0.07, chip.y + b + chip.w * 0.07, chip.w * 0.028, 0, Math.PI * 2);
  ctx.fillStyle = "#6c757d";
  ctx.fill();
}

// Two end caps along the part's long side.
function endCaps(ctx: CanvasRenderingContext2D, e: Rect, cap: number, color: string) {
  ctx.fillStyle = color;
  if (e.w >= e.h) {
    ctx.fillRect(e.x, e.y, cap, e.h);
    ctx.fillRect(e.x + e.w - cap, e.y, cap, e.h);
  } else {
    ctx.fillRect(e.x, e.y, e.w, cap);
    ctx.fillRect(e.x, e.y + e.h - cap, e.w, cap);
  }
}

// Parts are drawn at their base size, then scaled to fit the board.
function drawPart(ctx: CanvasRenderingContext2D, e: Part) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.scale(e.s, e.s);
  drawPartAtBase(ctx, {...e, x: 0, y: 0, w: e.w / e.s, h: e.h / e.s});
  ctx.restore();
}

function drawPartAtBase(ctx: CanvasRenderingContext2D, e: Part) {
  const {x, y, w, h} = e;
  switch (e.kind) {
    case "led": {
      // Long side along the board: pale body, an amber pad at each end, the lens in the middle.
      ctx.fillStyle = "#e8e4d8";
      ctx.fillRect(x, y, w, h);
      endCaps(ctx, e, 4, "#b8a37a");
      ctx.strokeStyle = "#8d8570";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = e.tint ?? "#ffb35c";
      ctx.fill();
      break;
    }
    case "button": {
      // Tactile switch: four legs, a pale housing and the square cap in the middle.
      ctx.fillStyle = "#8f98a1";
      for (const dy of [h * 0.18, h * 0.62]) {
        ctx.fillRect(x - 3, y + dy, 3, h * 0.2);
        ctx.fillRect(x + w, y + dy, 3, h * 0.2);
      }
      ctx.beginPath();
      roundedRect(ctx, x, y, w, h, 3);
      ctx.fillStyle = "#d9dcdf";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#8b949d";
      ctx.stroke();
      ctx.beginPath();
      roundedRect(ctx, x + w * 0.3, y + h * 0.2, w * 0.4, h * 0.6, 2);
      ctx.fillStyle = "#f1f3f4";
      ctx.fill();
      ctx.strokeStyle = "#a9b1b8";
      ctx.stroke();
      break;
    }
    case "crystal": {
      ctx.beginPath();
      roundedRect(ctx, x, y, w, h, 2.5);
      ctx.fillStyle = metalGradient(ctx, x, w);
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "#6f7a84";
      ctx.stroke();
      endCaps(ctx, e, 4, "rgba(120,100,50,0.55)");
      break;
    }
    case "regulator": {
      // Three legs on the left, the heat tab on the right.
      ctx.fillStyle = "#aeb6bd";
      for (let i = 0; i < 3; i++) ctx.fillRect(x - 3, y + 1.5 + i * ((h - 5) / 2), 4, 2);
      ctx.fillRect(x + w - 6, y + 2, 9, h - 4);
      ctx.fillStyle = "#23272c";
      ctx.fillRect(x, y, w - 5, h);
      break;
    }
    case "resistor": {
      ctx.fillStyle = "#1b1e22";
      ctx.fillRect(x, y, w, h);
      endCaps(ctx, e, 2.5, "#c3c9ce");
      break;
    }
    default: { // cap
      ctx.fillStyle = "#c8b48a";
      ctx.fillRect(x, y, w, h);
      endCaps(ctx, e, 2.5, "#8d7b55");
    }
  }
}

export interface ModulePaint {
  // Top-left corner of the pin footprint, as Ic.topLeftDot.
  x: number;
  y: number;
  widthPin: number; // current footprint, already swapped for 90°/270°
  heightPin: number;
  rotation: Rotation;
  selected: boolean;
  title: string;
}

function shapeOf(p: ModulePaint): ModuleShape {
  const sideways = isSideways(p.rotation);
  return moduleShape(sideways ? p.widthPin : p.heightPin, (sideways ? p.heightPin : p.widthPin) - 1);
}

export function drawModule(ctx: CanvasRenderingContext2D, p: ModulePaint) {
  const shape = shapeOf(p);
  const {tx, ty, angle} = placement(p.rotation, shape);
  const {board, pads, usb, chip, parts} = shape;

  ctx.save();
  ctx.translate(p.x + tx, p.y + ty);
  ctx.rotate(angle);

  ctx.beginPath();
  roundedRect(ctx, board.x, board.y, board.w, board.h, 5);
  ctx.fillStyle = BOARD_FILL;
  ctx.fill();
  ctx.lineWidth = p.selected ? 3 : 2;
  ctx.strokeStyle = p.selected ? "#38bdf8" : BOARD_EDGE_COLOR;
  ctx.stroke();

  // The socket is soldered on top, sticking out past the board's edge.
  if (usb) drawUsb(ctx, usb);

  // Plated holes with a pin through each. Pin 1 is square.
  for (const pad of pads) {
    ctx.beginPath();
    if (pad.first) ctx.rect(pad.x - PAD_RADIUS + 1, pad.y - PAD_RADIUS + 1, 2 * PAD_RADIUS - 2, 2 * PAD_RADIUS - 2);
    else ctx.arc(pad.x, pad.y, PAD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#d9b25a";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#8a6a22";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, HOLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#b4bcc4";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#4a535b";
    ctx.stroke();
  }

  for (const part of parts) drawPart(ctx, part);
  if (chip) drawMcu(ctx, chip);
  ctx.restore();

  drawName(ctx, p, shape);
}

// Printed along the long axis, always upright for the reader: left to right when the board
// lies across, bottom to top when it stands. Sits on the chip, or on the board.
function drawName(ctx: CanvasRenderingContext2D, p: ModulePaint, shape: ModuleShape) {
  if (!p.title) return;
  const target = shape.chip ?? shape.board;
  const {tx, ty, angle} = placement(p.rotation, shape);
  const cx = target.x + target.w / 2;
  const cy = target.y + target.h / 2;
  const sx = p.x + tx + cx * Math.cos(angle) - cy * Math.sin(angle);
  const sy = p.y + ty + cx * Math.sin(angle) + cy * Math.cos(angle);

  ctx.save();
  ctx.translate(sx, sy);
  if (!isSideways(p.rotation)) ctx.rotate(-Math.PI / 2);
  const maxSize = Math.max(10, Math.min(17, target.w * 0.2));
  ctx.font = `600 ${maxSize}px monospace`;
  const room = target.h * 0.6;
  const size = Math.min(maxSize, (maxSize * room) / Math.max(1, ctx.measureText(p.title).width));
  ctx.font = `600 ${size}px monospace`;
  ctx.fillStyle = "#d7dee4";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.title, 0, 0);
  ctx.restore();
}

// A small generic board for the catalog: 8 pins per row, 4 holes wide, lying across the page.
// Only fixed colors and no ids, so any number of these can share a page.
export function moduleIconSvg(): string {
  const shape = moduleShape(8, 4);
  const {tx, ty, angle} = placement(90, shape);
  const {board, pads, usb, chip, parts} = shape;
  const deg = (angle * 180) / Math.PI;
  const overhang = usb ? -usb.y - MODULE_END : 0;
  const wide = shape.height + 2 * MODULE_END + overhang;
  const tall = shape.width + 2 * MODULE_EDGE;
  const holes = pads
    .map(a => `<circle cx="${a.x}" cy="${a.y}" r="${PAD_RADIUS}" fill="#d9b25a" stroke="#8a6a22" stroke-width="2"/>`
      + `<circle cx="${a.x}" cy="${a.y}" r="${HOLE_RADIUS}" fill="#b4bcc4" stroke="#4a535b" stroke-width="2"/>`)
    .join("");
  const fills: Record<string, string> = {led: "#e8e4d8", button: "#d9dcdf", crystal: "#aeb6bd", cap: "#c8b48a"};
  const small = parts
    .map(q => `<rect x="${q.x}" y="${q.y}" width="${q.w}" height="${q.h}" fill="${fills[q.kind] ?? "#23272c"}" stroke="#4a535b" stroke-width="1.5"/>`)
    .join("");
  const socket = usb
    ? `<rect x="${usb.x}" y="${usb.y}" width="${usb.w}" height="${usb.h}" rx="6" fill="#aeb6bd" stroke="#6f7a84" stroke-width="2"/>`
    : "";
  const mcu = chip
    ? `<rect x="${chip.x}" y="${chip.y}" width="${chip.w}" height="${chip.h}" rx="4" fill="#23272c" stroke="#0d0f11" stroke-width="3"/>`
      + `<circle cx="${chip.x + chip.w * 0.15}" cy="${chip.y + chip.h * 0.15}" r="3.5" fill="#6c757d"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-MODULE_END} ${-MODULE_EDGE} ${wide} ${tall}" aria-hidden="true">`
    + `<g transform="translate(${tx} ${ty}) rotate(${deg})">`
    + `<rect x="${board.x}" y="${board.y}" width="${board.w}" height="${board.h}" rx="5" fill="${BOARD_FILL}" stroke="${BOARD_EDGE_COLOR}" stroke-width="3"/>`
    + socket + holes + small + mcu
    + `</g></svg>`;
}
