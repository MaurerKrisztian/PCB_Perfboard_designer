import {Canvas} from "../../state/Canvas";
import {AdvancedComponentDefinition, getAdvancedIconPath, PIN_TILE_HALF} from "./advanced-component-definitions";
import {getCachedIcon} from "../standard-components/icon-cache";
import {rotateOffset} from "./rotate-offset";
import {GridConfig} from "../../state/GridConfig";

// How far the body box extends past the outermost pins, when there's no explicit bodyOutline.
export const PIN_PAD = 16;
const PIN_MARKER_RADIUS = 3;
const PIN1_MARKER_RADIUS = 4;
const BODY_COLOR = "rgba(17,24,39,0.85)";
const BODY_COLOR_SELECTED = "rgba(30,58,138,0.9)";
const BORDER_COLOR = "#475569";
const BORDER_COLOR_SELECTED = "#38bdf8";
const PIN_COLOR = "#cbd5e1";
const PIN1_COLOR = "#38bdf8";
const SHADED_PIN_COLOR = "rgba(148,163,184,0.35)";
const PIN_LABEL_FONT = "700 11px monospace, sans-serif";
const PIN_LABEL_COLOR = "#f8fafc";
// Dark halo stroked behind each pin number so it stays readable wherever it lands - over
// the board background, a dark body fill, or a light patch of an icon (e.g. the MOSFET's
// metal tab, which the plain light-grey text used to disappear into).
const PIN_LABEL_HALO_COLOR = "rgba(2,6,23,0.9)";
const PIN_LABEL_HALO_WIDTH = 3;
// Local, pre-rotation offset (grid units) from a pin to where its number label is drawn.
// Definitions whose body would sit on top of that spot override it with pinLabelOffset.
const PIN_LABEL_OFFSET = {dx: 0, dy: -0.35};
// Fallback colors for a perPinIcon tile, used until its SVG has loaded (and if it never does).
// Deliberately close to the artwork so a missing icon degrades rather than breaks the drawing.
const TILE_BODY_COLOR = "#1f1f26";
const TILE_PAD_COLOR = "#e8d296";
const TILE_PAD_RADIUS_RATIO = 0.13;

export interface Point {
  x: number;
  y: number;
}

export interface DrawAdvancedComponentOptions {
  selected?: boolean;
  ghost?: boolean;
}

export function getBoundingRect(points: Point[], pad: number = 0) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
}

// Parts whose icon is one pin's artwork (header pins): the tiles themselves are the body, so
// there's no body polygon, no pin markers and no pin numbers to draw - a 2x20 header would
// otherwise be buried under 40 numbers and 40 marker dots.
function drawTiledPinComponent(
  pins: Point[],
  outline: Point[],
  def: AdvancedComponentDefinition,
  options: DrawAdvancedComponentOptions
) {
  const icon = getCachedIcon(getAdvancedIconPath(def));
  const iconLoaded = icon.loaded && !icon.failed;
  // One full grid pitch per tile, so neighbouring pins butt into a continuous strip.
  const tileSize = PIN_TILE_HALF * 2 * GridConfig.dotSpace;
  const half = tileSize / 2;

  Canvas.ctx.save();
  if (options.ghost) {
    Canvas.ctx.globalAlpha = 0.55;
  }

  pins.forEach((pin) => {
    if (iconLoaded) {
      // The tile is square, so it looks the same at every rotation - no ctx.rotate needed.
      Canvas.ctx.drawImage(icon.img, pin.x - half, pin.y - half, tileSize, tileSize);
      return;
    }
    Canvas.ctx.fillStyle = TILE_BODY_COLOR;
    Canvas.ctx.fillRect(pin.x - half, pin.y - half, tileSize, tileSize);
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = TILE_PAD_COLOR;
    Canvas.ctx.arc(pin.x, pin.y, tileSize * TILE_PAD_RADIUS_RATIO, 0, Math.PI * 2);
    Canvas.ctx.fill();
  });

  // Without a body fill there's nothing else to carry selection/ghost state, so outline the
  // whole block instead.
  if ((options.selected || options.ghost) && outline.length >= 3) {
    const rect = getBoundingRect(outline);
    Canvas.ctx.beginPath();
    Canvas.ctx.strokeStyle = BORDER_COLOR_SELECTED;
    Canvas.ctx.lineWidth = options.selected ? 3 : 2;
    if (options.ghost) Canvas.ctx.setLineDash([6, 4]);
    Canvas.ctx.rect(rect.x, rect.y, rect.w, rect.h);
    Canvas.ctx.stroke();
  }

  Canvas.ctx.restore();
}

export function drawAdvancedComponentBody(
  pins: Point[],
  shadedPins: Point[],
  outline: Point[],
  iconAnchor: Point,
  def: AdvancedComponentDefinition,
  rotationAngle: 0 | 90 | 180 | 270,
  options: DrawAdvancedComponentOptions = {}
) {
  if (pins.length === 0) return;
  if (def.perPinIcon) {
    drawTiledPinComponent(pins, outline, def, options);
    return;
  }
  const hasOutline = outline.length >= 3;
  const rect = hasOutline ? getBoundingRect(outline) : getBoundingRect([...pins, ...shadedPins], PIN_PAD);

  Canvas.ctx.save();
  if (options.ghost) {
    Canvas.ctx.globalAlpha = 0.55;
    Canvas.ctx.setLineDash([6, 4]);
  }

  // Shaded (covered-but-unconnected) holes, drawn dimmer and underneath the real pin markers.
  shadedPins.forEach((pin) => {
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = SHADED_PIN_COLOR;
    Canvas.ctx.arc(pin.x, pin.y, PIN_MARKER_RADIUS, 0, Math.PI * 2);
    Canvas.ctx.fill();
  });

  // Pin markers, drawn first so the body shape below covers the inner ends of each pin.
  pins.forEach((pin, i) => {
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = i === 0 ? PIN1_COLOR : PIN_COLOR;
    Canvas.ctx.arc(pin.x, pin.y, i === 0 ? PIN1_MARKER_RADIUS : PIN_MARKER_RADIUS, 0, Math.PI * 2);
    Canvas.ctx.fill();
  });

  const icon = getCachedIcon(getAdvancedIconPath(def));
  const iconLoaded = icon.loaded && !icon.failed;
  // For parts whose icon is meant to be the entire visible body, skip the box (fill + border)
  // entirely once the icon has actually loaded so only the SVG artwork shows.
  const skipBody = def.iconFillsBody && iconLoaded;

  if (!skipBody) {
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = options.selected ? BODY_COLOR_SELECTED : BODY_COLOR;
    Canvas.ctx.strokeStyle = options.selected ? BORDER_COLOR_SELECTED : BORDER_COLOR;
    Canvas.ctx.lineWidth = options.selected ? 3 : 2;
    if (hasOutline) {
      Canvas.ctx.moveTo(outline[0].x, outline[0].y);
      for (let i = 1; i < outline.length; i++) {
        Canvas.ctx.lineTo(outline[i].x, outline[i].y);
      }
      Canvas.ctx.closePath();
    } else {
      Canvas.ctx.rect(rect.x, rect.y, rect.w, rect.h);
    }
    Canvas.ctx.fill();
    Canvas.ctx.stroke();
  }

  // rect measures the body box *after* rotation, so at 90/270 its width and height are
  // swapped relative to the artwork. Size the icon against the unrotated box, then turn it
  // into place below - sizing it against rect instead squashes a wide part into a tall box.
  const quarterTurned = rotationAngle === 90 || rotationAngle === 270;
  const boxW = quarterTurned ? rect.h : rect.w;
  const boxH = quarterTurned ? rect.w : rect.h;

  let iconW: number;
  let iconH: number;
  if (def.iconSize) {
    iconW = iconH = def.iconSize;
  } else if (def.iconFillsBody) {
    // Stretch to exactly fill the body box, rather than preserving the icon's native aspect
    // ratio - lets a definition's bodyOutline shape the part's proportions independently of
    // the source artwork (e.g. a MOSFET stretched a bit longer/thinner than its icon file).
    iconW = boxW;
    iconH = boxH;
  } else if (iconLoaded && icon.img.naturalWidth && icon.img.naturalHeight) {
    // Fit the icon's real aspect ratio inside the body box instead of forcing it into a
    // square, so parts with a non-square icon (e.g. a wide MOSFET footprint) fill the box.
    const fill = 0.9;
    const scale = Math.min((boxW * fill) / icon.img.naturalWidth, (boxH * fill) / icon.img.naturalHeight);
    iconW = icon.img.naturalWidth * scale;
    iconH = icon.img.naturalHeight * scale;
  } else {
    iconW = iconH = Math.min(boxW, boxH) * 0.7;
  }
  if (iconLoaded) {
    // Only the artwork turns with the part - the fallback label and pin numbers below stay
    // upright so they remain readable at every rotation.
    Canvas.ctx.save();
    Canvas.ctx.translate(iconAnchor.x, iconAnchor.y);
    Canvas.ctx.rotate((rotationAngle * Math.PI) / 180);
    Canvas.ctx.drawImage(icon.img, -iconW / 2, -iconH / 2, iconW, iconH);
    Canvas.ctx.restore();
  } else {
    Canvas.ctx.setLineDash([]);
    Canvas.ctx.fillStyle = "#ffffff";
    Canvas.ctx.font = "bold 11px Inter, Arial";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.textBaseline = "middle";
    Canvas.ctx.fillText(def.fallbackLabel, iconAnchor.x, iconAnchor.y);
  }

  // Pin number labels, drawn last so they stay legible over the body/icon.
  Canvas.ctx.setLineDash([]);
  Canvas.ctx.font = PIN_LABEL_FONT;
  Canvas.ctx.fillStyle = PIN_LABEL_COLOR;
  Canvas.ctx.textAlign = "center";
  Canvas.ctx.textBaseline = "middle";
  Canvas.ctx.strokeStyle = PIN_LABEL_HALO_COLOR;
  Canvas.ctx.lineWidth = PIN_LABEL_HALO_WIDTH;
  Canvas.ctx.lineJoin = "round";
  const pinLabelOffset = def.pinLabelOffset ?? PIN_LABEL_OFFSET;
  const labelOffset = rotateOffset(pinLabelOffset.dx, pinLabelOffset.dy, rotationAngle);
  pins.forEach((pin, i) => {
    const x = pin.x + labelOffset.x * GridConfig.dotSpace;
    const y = pin.y + labelOffset.y * GridConfig.dotSpace;
    Canvas.ctx.strokeText(String(i + 1), x, y);
    Canvas.ctx.fillText(String(i + 1), x, y);
  });

  Canvas.ctx.restore();
}
