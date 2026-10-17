import {Rotation} from "../../../project-file/project-file";
import {LinearGradient, Painter} from "../../painter/painter";
import {SvgPainter} from "../../painter/svg-painter";
import {SELECTION_COLOR} from "../../palette";

// Top view of a DIP package with gull-wing leads, drawn from pin counts alone so any size works.
// The board renderer paints it for every placed chip and the catalog buttons use it as an SVG,
// both from this one drawing. Sizes are drawing px at a 50px pitch (2.54mm).
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

const leadMetal = (lead: Rect): LinearGradient => ({
  kind: "linear", x1: 0, y1: lead.y, x2: 0, y2: lead.y + lead.h,
  stops: [{offset: 0, color: "#e3e7eb"}, {offset: 0.5, color: "#b4bcc4"}, {offset: 1, color: "#8b949d"}],
});

export interface DipPaint {
  // Top-left corner of the pin footprint (the top-left pin).
  x: number;
  y: number;
  widthPin: number; // current footprint, already swapped for 90°/270°
  heightPin: number;
  rotation: Rotation;
  selected: boolean;
  title: string;
}

export function drawDip(painter: Painter, p: DipPaint) {
  const sideways = isSideways(p.rotation);
  const shape = dipShape(sideways ? p.widthPin : p.heightPin, PITCH * ((sideways ? p.heightPin : p.widthPin) - 1));
  const {tx, ty, angle} = placement(p.rotation, shape);

  painter.group({translate: [p.x + tx, p.y + ty], rotate: angle}, () => {
    for (const lead of shape.leads) {
      painter.rect(lead.x, lead.y, lead.w, lead.h, {fill: leadMetal(lead), stroke: {paint: "#6f7a84", width: 1}}, 5);
    }

    const {body} = shape;
    painter.rect(body.x, body.y, body.w, body.h, {
      fill: p.selected ? "rgba(30,58,138,1)" : "rgba(30,34,40,1)",
      stroke: {paint: p.selected ? SELECTION_COLOR : "#0d0f11", width: p.selected ? 3 : 2},
    }, 4);
    painter.rect(body.x + 3, body.y + 3, body.w - 6, body.h - 6, {stroke: {paint: "rgba(255,255,255,0.12)", width: 1.5}}, 2.5);

    painter.arc(shape.notch.x, shape.notch.y, NOTCH_RADIUS, 0, Math.PI, {fill: p.selected ? "#0b1220" : "#0d0f11"});
    painter.circle(shape.pin1.x, shape.pin1.y, 3.6, {fill: "#0d0f11", stroke: {paint: "rgba(255,255,255,0.25)", width: 1}});
  });

  drawName(painter, p, shape, sideways);
}

// Printed along the long axis, always upright for the reader: left to right when the chip lies
// across the board, bottom to top when it stands.
function drawName(painter: Painter, p: DipPaint, shape: DipShape, sideways: boolean) {
  if (!p.title) return;
  const footprintW = sideways ? shape.height : shape.width;
  const footprintH = sideways ? shape.width : shape.height;
  const bodyLong = shape.height + 2 * DIP_OVERHANG;
  const bodyShort = shape.width - 2 * DIP_INSET;

  const maxSize = Math.max(11, Math.min(18, bodyShort * 0.17));
  const room = bodyLong * 0.62;
  const size = Math.min(maxSize, (maxSize * room) / Math.max(1, painter.measureText(p.title, {family: "mono", size: maxSize, weight: 600})));
  painter.group({translate: [p.x + footprintW / 2, p.y + footprintH / 2], rotate: sideways ? 0 : -Math.PI / 2}, () => {
    painter.text(p.title, 0, 0, {
      font: {family: "mono", size, weight: 600}, color: p.selected ? "#e0f2fe" : "#b7c0c9", align: "center", baseline: "middle",
    });
  });
}

// A small generic chip for the catalog: a DIP-8 lying across the page.
export function dipIconSvg(): string {
  const painter = new SvgPainter();
  const paint: DipPaint = {x: DIP_OVERHANG, y: LEAD_REACH, widthPin: 4, heightPin: 4, rotation: 90, selected: false, title: ""};
  drawDip(painter, paint);
  return painter.toSvg(3 * PITCH + 2 * DIP_OVERHANG, 3 * PITCH + 2 * LEAD_REACH);
}
