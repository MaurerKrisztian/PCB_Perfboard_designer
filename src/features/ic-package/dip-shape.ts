// Top view of a DIP package with gull-wing leads, drawn from pin counts alone so any size works.
// Pure drawing code (no editor state): the editor paints it on the canvas and the catalog buttons
// use the SVG, both from the same geometry. Sizes are canvas px at a 50px pitch (2.54mm).
//
// The shape is laid out "upright": pin 1 top left, pins down both sides, the notch on top. A
// rotation then turns the whole thing about the grid, so the notch and pin 1 follow.

const PITCH = 50;
// The body stands this far inside the pin rows (a real 7.62mm DIP's body is ~0.86mm narrower
// than its row spacing, per side) and runs this far past the first and last pin.
export const DIP_INSET = 17;
export const DIP_OVERHANG = 22;
const LEAD_WIDTH = 20;
const LEAD_REACH = 7; // past the hole centre, so the lead ends around the hole
const LEAD_UNDER = 14; // how far the lead runs under the body, where it shows faintly through
const NOTCH_RADIUS = 9;

type Rotation = 0 | 90 | 180 | 270;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DipShape {
  leads: Rect[];
  body: Rect;
  notch: {x: number; y: number};
  pin1: {x: number; y: number};
  width: number; // upright footprint between the pin rows
  height: number;
}

function dipShape(pinsPerSide: number, rowSpan: number): DipShape {
  const height = PITCH * (pinsPerSide - 1);
  const leads: Rect[] = [];
  for (let i = 0; i < pinsPerSide; i++) {
    const y = i * PITCH - LEAD_WIDTH / 2;
    leads.push({x: -LEAD_REACH, y, w: DIP_INSET + LEAD_REACH + LEAD_UNDER, h: LEAD_WIDTH});
    leads.push({x: rowSpan - DIP_INSET - LEAD_UNDER, y, w: DIP_INSET + LEAD_REACH + LEAD_UNDER, h: LEAD_WIDTH});
  }
  const body = {x: DIP_INSET, y: -DIP_OVERHANG, w: rowSpan - 2 * DIP_INSET, h: height + 2 * DIP_OVERHANG};
  return {
    leads,
    body,
    notch: {x: body.x + body.w / 2, y: body.y},
    pin1: {x: body.x + 11, y: body.y + 14},
    width: rowSpan,
    height,
  };
}

// Where the upright shape's origin (pin 1) lands in the rotated footprint, and the turn to apply.
function placement(rotation: Rotation, shape: DipShape): {tx: number; ty: number; angle: number} {
  switch (rotation) {
    case 90: return {tx: shape.height, ty: 0, angle: Math.PI / 2};
    case 180: return {tx: shape.width, ty: shape.height, angle: Math.PI};
    case 270: return {tx: 0, ty: shape.width, angle: -Math.PI / 2};
    default: return {tx: 0, ty: 0, angle: 0};
  }
}

// The upright shape's pin rows: along y at 0°/180°, along x when turned sideways.
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

export interface DipPaint {
  // Top-left corner of the pin footprint, as Ic.topLeftDot.
  x: number;
  y: number;
  widthPin: number; // current footprint, already swapped for 90°/270°
  heightPin: number;
  rotation: Rotation;
  selected: boolean;
  title: string;
}

export function drawDip(ctx: CanvasRenderingContext2D, p: DipPaint) {
  const sideways = isSideways(p.rotation);
  const shape = dipShape(sideways ? p.widthPin : p.heightPin, PITCH * ((sideways ? p.heightPin : p.widthPin) - 1));
  const {tx, ty, angle} = placement(p.rotation, shape);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.translate(tx, ty);
  ctx.rotate(angle);

  for (const lead of shape.leads) {
    const metal = ctx.createLinearGradient(0, lead.y, 0, lead.y + lead.h);
    metal.addColorStop(0, "#e3e7eb");
    metal.addColorStop(0.5, "#b4bcc4");
    metal.addColorStop(1, "#8b949d");
    ctx.beginPath();
    roundedRect(ctx, lead.x, lead.y, lead.w, lead.h, 5);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#6f7a84";
    ctx.stroke();
  }

  // A little see-through, so the part of each lead under the body stays faintly visible.
  const {body} = shape;
  ctx.beginPath();
  roundedRect(ctx, body.x, body.y, body.w, body.h, 4);
  ctx.fillStyle = p.selected ? "rgba(30,58,138,1)" : "rgba(30,34,40,1)";
  ctx.fill();
  ctx.lineWidth = p.selected ? 3 : 2;
  ctx.strokeStyle = p.selected ? "#38bdf8" : "#0d0f11";
  ctx.stroke();

  ctx.beginPath();
  roundedRect(ctx, body.x + 3, body.y + 3, body.w - 6, body.h - 6, 2.5);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(shape.notch.x, shape.notch.y, NOTCH_RADIUS, 0, Math.PI);
  ctx.fillStyle = p.selected ? "#0b1220" : "#0d0f11";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(shape.pin1.x, shape.pin1.y, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = "#0d0f11";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  drawName(ctx, p, shape, sideways);
}

// Printed along the long axis, always upright for the reader: left to right when the chip lies
// across the board, bottom to top when it stands.
function drawName(ctx: CanvasRenderingContext2D, p: DipPaint, shape: DipShape, sideways: boolean) {
  if (!p.title) return;
  const footprintW = sideways ? shape.height : shape.width;
  const footprintH = sideways ? shape.width : shape.height;
  const bodyLong = shape.height + 2 * DIP_OVERHANG;
  const bodyShort = shape.width - 2 * DIP_INSET;

  ctx.save();
  ctx.translate(p.x + footprintW / 2, p.y + footprintH / 2);
  if (!sideways) ctx.rotate(-Math.PI / 2);
  const maxSize = Math.max(11, Math.min(18, bodyShort * 0.17));
  ctx.font = `600 ${maxSize}px monospace`;
  const room = bodyLong * 0.62;
  const size = Math.min(maxSize, (maxSize * room) / Math.max(1, ctx.measureText(p.title).width));
  ctx.font = `600 ${size}px monospace`;
  ctx.fillStyle = p.selected ? "#e0f2fe" : "#b7c0c9";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(p.title, 0, 0);
  ctx.restore();
}

// A small generic chip for the catalog: a DIP-8 lying across the page. Only fixed colors and no
// ids, so any number of these can share a page.
export function dipIconSvg(): string {
  const shape = dipShape(4, 3 * PITCH);
  const {tx, ty, angle} = placement(90, shape);
  const leads = shape.leads
    .map(l => `<rect x="${l.x}" y="${l.y}" width="${l.w}" height="${l.h}" rx="5" fill="#b4bcc4" stroke="#6f7a84" stroke-width="2"/>`)
    .join("");
  const {body, notch, pin1} = shape;
  const deg = (angle * 180) / Math.PI;
  const wide = shape.height + 2 * DIP_OVERHANG, tall = shape.width + 2 * LEAD_REACH;
  return `<svg class="ic-icon" viewBox="${-DIP_OVERHANG} ${-LEAD_REACH} ${wide} ${tall}" aria-hidden="true">`
    + `<g transform="translate(${tx} ${ty}) rotate(${deg})">${leads}`
    + `<rect x="${body.x}" y="${body.y}" width="${body.w}" height="${body.h}" rx="4" fill="#23272c" stroke="#0d0f11" stroke-width="3"/>`
    + `<path d="M ${notch.x - NOTCH_RADIUS} ${notch.y} A ${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 0 0 ${notch.x + NOTCH_RADIUS} ${notch.y} Z" fill="#0d0f11"/>`
    + `<circle cx="${pin1.x}" cy="${pin1.y}" r="4" fill="#0d0f11" stroke="#ffffff" stroke-opacity="0.35"/>`
    + `</g></svg>`;
}
