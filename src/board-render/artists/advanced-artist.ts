import {getIconFile} from "../../parts/component-definitions";
import {PIN_TILE_HALF} from "../../parts/advanced-component-definitions";
import {rotateOffset} from "../../parts/rotate-offset";
import {GRID_PITCH_PX, gridToPx} from "../../project-file/grid";
import {SavedAdvancedComponent} from "../../project-file/project-file";
import {Painter, Point, ShapeStyle} from "../painter/painter";
import {GHOST_DASH, GHOST_OPACITY, LABEL_HALO, SELECTION_COLOR} from "../palette";
import {AdvancedGeometry, advancedPartGeometry, boundingRect, Rect} from "./advanced-geometry";
import {labelText, PartArtist, PartLook} from "./part-artist";

// Fixed-pin parts (pots, transistors, switches, header pins…): pin markers, the body (its outline
// or a box around the pins), the part's icon on it, and the pin numbers.

const PIN_MARKER_RADIUS = 3;
const PIN1_MARKER_RADIUS = 4;
const BODY_COLOR = "rgba(17,24,39,0.85)";
const BODY_COLOR_SELECTED = "rgba(30,58,138,0.9)";
const BORDER_COLOR = "#475569";
const PIN_COLOR = "#cbd5e1";
const PIN1_COLOR = "#38bdf8";
const SHADED_PIN_COLOR = "rgba(148,163,184,0.35)";
const PIN_LABEL_FONT = {family: "mono", size: 11, weight: 700} as const;
const PIN_LABEL_COLOR = "#f8fafc";
// Local, pre-rotation offset (grid units) from a pin to where its number label is drawn.
// Definitions whose body would sit on top of that spot override it with pinLabelOffset.
const PIN_LABEL_OFFSET = {dx: 0, dy: -0.35};
// Stand-in colors for a perPinIcon tile, used until its SVG has loaded (and if it never does).
// Deliberately close to the artwork so a missing icon degrades rather than breaks the drawing.
const TILE_BODY_COLOR = "#1f1f26";
const TILE_PAD_COLOR = "#e8d296";
const TILE_PAD_RADIUS_RATIO = 0.13;
const LABEL_GAP = 3;

// The body's shape: its outline, or the box around its pins.
function drawBodyShape(painter: Painter, g: AdvancedGeometry, style: ShapeStyle) {
  if (g.outline.length >= 3) painter.polygon(g.outline, style);
  else painter.rect(g.bodyRect.x, g.bodyRect.y, g.bodyRect.w, g.bodyRect.h, style);
}

// Parts whose icon is one pin's artwork (header pins): the tiles themselves are the body, so
// there's no body polygon, no pin markers and no pin numbers to draw - a 2x20 header would
// otherwise be buried under 40 numbers and 40 marker dots.
function drawTiledPins(painter: Painter, g: AdvancedGeometry, look: PartLook) {
  // One full grid pitch per tile, so neighbouring pins butt into a continuous strip.
  const tile = PIN_TILE_HALF * 2 * GRID_PITCH_PX;
  const half = tile / 2;
  for (const pin of g.pins) {
    // The tile is square, so it looks the same at every rotation.
    if (painter.image(getIconFile(g.def), pin.x - half, pin.y - half, tile, tile)) continue;
    painter.rect(pin.x - half, pin.y - half, tile, tile, {fill: TILE_BODY_COLOR});
    painter.circle(pin.x, pin.y, tile * TILE_PAD_RADIUS_RATIO, {fill: TILE_PAD_COLOR});
  }
  // Without a body fill there's nothing else to carry the selected or ghost look, so outline the
  // whole block instead.
  if ((look.selected || look.ghost) && g.outline.length >= 3) {
    const rect = boundingRect(g.outline);
    painter.rect(rect.x, rect.y, rect.w, rect.h, {
      stroke: {paint: SELECTION_COLOR, width: look.selected ? 3 : 2, ...(look.ghost ? {dash: GHOST_DASH} : {})},
    });
  }
}

// How big the icon is drawn, in the part's unrotated frame.
function iconBox(painter: Painter, g: AdvancedGeometry, rect: Rect, quarterTurned: boolean): {w: number; h: number} {
  // rect measures the body box *after* rotation, so at 90/270 its width and height are
  // swapped relative to the artwork. Size the icon against the unrotated box, then turn it
  // into place - sizing it against rect instead squashes a wide part into a tall box.
  const boxW = quarterTurned ? rect.h : rect.w;
  const boxH = quarterTurned ? rect.w : rect.h;
  if (g.def.iconSize) return {w: g.def.iconSize, h: g.def.iconSize};
  // Stretch to exactly fill the body box, rather than keeping the icon's own aspect ratio, so a
  // definition's bodyOutline shapes the part's proportions independently of the source artwork
  // (e.g. a MOSFET stretched a bit longer/thinner than its icon file).
  if (g.def.iconFillsBody) return {w: boxW, h: boxH};
  // Fit the icon's real aspect ratio inside the body box instead of forcing it into a square,
  // so parts with a non-square icon (e.g. a wide MOSFET footprint) fill the box.
  const size = painter.iconSize(getIconFile(g.def));
  if (size) {
    const scale = Math.min((boxW * 0.9) / size.width, (boxH * 0.9) / size.height);
    return {w: size.width * scale, h: size.height * scale};
  }
  const side = Math.min(boxW, boxH) * 0.7;
  return {w: side, h: side};
}

function drawBody(painter: Painter, g: AdvancedGeometry, rotation: number, look: PartLook) {
  const {def} = g;
  // Shaded (covered-but-unconnected) holes, drawn dimmer and underneath the real pin markers.
  for (const pin of g.shaded) painter.circle(pin.x, pin.y, PIN_MARKER_RADIUS, {fill: SHADED_PIN_COLOR});
  // Pin markers, drawn first so the body shape covers the inner ends of each pin.
  g.pins.forEach((pin, i) => {
    painter.circle(pin.x, pin.y, i === 0 ? PIN1_MARKER_RADIUS : PIN_MARKER_RADIUS, {fill: i === 0 ? PIN1_COLOR : PIN_COLOR});
  });

  const icon = getIconFile(def);
  const iconAvailable = painter.iconSize(icon) !== undefined;
  // For parts whose icon is meant to be the entire visible body, skip the box (fill + border)
  // entirely once the icon is there, so only the SVG artwork shows.
  const skipBody = def.iconFillsBody && iconAvailable;
  if (!skipBody) {
    drawBodyShape(painter, g, {
      fill: look.selected ? BODY_COLOR_SELECTED : BODY_COLOR,
      stroke: {paint: look.selected ? SELECTION_COLOR : BORDER_COLOR, width: look.selected ? 3 : 2, ...(look.ghost ? {dash: GHOST_DASH} : {})},
    });
  }

  const quarterTurned = rotation === 90 || rotation === 270;
  const {w, h} = iconBox(painter, g, g.bodyRect, quarterTurned);
  // Only the artwork turns with the part - the stand-in label and pin numbers stay upright so
  // they remain readable at every rotation.
  let drawn = false;
  painter.group({translate: [g.iconAnchor.x, g.iconAnchor.y], rotate: (rotation * Math.PI) / 180}, () => {
    drawn = painter.image(icon, -w / 2, -h / 2, w, h);
  });
  if (!drawn) {
    painter.text(def.fallbackLabel, g.iconAnchor.x, g.iconAnchor.y, {
      font: {family: "sans", size: 11, weight: 700}, color: "#ffffff", align: "center", baseline: "middle",
    });
  }

  if (skipBody && look.selected) drawBodyShape(painter, g, {stroke: {paint: SELECTION_COLOR, width: 3}});

  // Pin number labels, drawn last so they stay legible over the body and icon.
  const offset = def.pinLabelOffset ?? PIN_LABEL_OFFSET;
  const shift = rotateOffset(offset.dx, offset.dy, rotation as 0 | 90 | 180 | 270);
  g.pins.forEach((pin, i) => {
    painter.text(def.pinLabels?.[i] ?? String(i + 1), pin.x + shift.x * GRID_PITCH_PX, pin.y + shift.y * GRID_PITCH_PX, {
      font: PIN_LABEL_FONT, color: PIN_LABEL_COLOR, align: "center", baseline: "middle", halo: LABEL_HALO,
    });
  });
}

export const advancedArtist: PartArtist<SavedAdvancedComponent> = {
  layer: "over-wires",

  draw(painter, part, look) {
    const g = advancedPartGeometry(part);
    if (!g || g.pins.length === 0) return;
    painter.group(look.ghost ? {opacity: GHOST_OPACITY} : {}, () => {
      if (g.def.perPinIcon) drawTiledPins(painter, g, look);
      else drawBody(painter, g, part.rotation, look);
    });
  },

  // Printed on the body where the package has room for it (valueLabelOffset), else below the
  // body (pin numbers sit above the pins), or above it on the board's bottom edge.
  label(part) {
    const text = labelText(part.ref, part.value);
    const g = advancedPartGeometry(part);
    if (!text || !g) return undefined;
    const onBody = g.def.valueLabelOffset;
    if (onBody) {
      const r = rotateOffset(onBody.dx, onBody.dy, part.rotation);
      const at: Point = {x: gridToPx(part.at[0]) + r.x * GRID_PITCH_PX, y: gridToPx(part.at[1]) + r.y * GRID_PITCH_PX};
      return {text, at, vertical: part.rotation === 90 || part.rotation === 270};
    }
    const rect = g.bodyRect;
    const centerX = rect.x + rect.w / 2;
    return {text, spots: [
      (w) => ({x: centerX - w / 2, y: rect.y + rect.h + LABEL_GAP}),
      (w, h) => ({x: centerX - w / 2, y: rect.y - LABEL_GAP - h}),
    ]};
  },
};
