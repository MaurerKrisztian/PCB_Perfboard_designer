import {Canvas} from "../../state/Canvas";
import {AdvancedComponentDefinition, getAdvancedIconPath} from "./advanced-component-definitions";
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
const PIN_LABEL_FONT = "600 9px monospace, sans-serif";
const PIN_LABEL_COLOR = "#e2e8f0";
// Local, pre-rotation offset (grid units) from a pin to where its number label is drawn.
const PIN_LABEL_OFFSET = {dx: 0, dy: -0.35};

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

  let iconW: number;
  let iconH: number;
  if (def.iconSize) {
    iconW = iconH = def.iconSize;
  } else if (def.iconFillsBody) {
    // Stretch to exactly fill the body box, rather than preserving the icon's native aspect
    // ratio - lets a definition's bodyOutline shape the part's proportions independently of
    // the source artwork (e.g. a MOSFET stretched a bit longer/thinner than its icon file).
    iconW = rect.w;
    iconH = rect.h;
  } else if (iconLoaded && icon.img.naturalWidth && icon.img.naturalHeight) {
    // Fit the icon's real aspect ratio inside the body box instead of forcing it into a
    // square, so parts with a non-square icon (e.g. a wide MOSFET footprint) fill the box.
    const fill = 0.9;
    const scale = Math.min((rect.w * fill) / icon.img.naturalWidth, (rect.h * fill) / icon.img.naturalHeight);
    iconW = icon.img.naturalWidth * scale;
    iconH = icon.img.naturalHeight * scale;
  } else {
    iconW = iconH = Math.min(rect.w, rect.h) * 0.7;
  }
  if (iconLoaded) {
    Canvas.ctx.drawImage(icon.img, iconAnchor.x - iconW / 2, iconAnchor.y - iconH / 2, iconW, iconH);
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
  const labelOffset = rotateOffset(PIN_LABEL_OFFSET.dx, PIN_LABEL_OFFSET.dy, rotationAngle);
  pins.forEach((pin, i) => {
    Canvas.ctx.fillText(
      String(i + 1),
      pin.x + labelOffset.x * GridConfig.dotSpace,
      pin.y + labelOffset.y * GridConfig.dotSpace
    );
  });

  Canvas.ctx.restore();
}
