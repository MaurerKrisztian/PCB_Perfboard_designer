import {Canvas} from "../../state/Canvas";
import {IDot} from "../../interfaces/dot.interface";
import {ComponentDefinition, getIconPath} from "./component-definitions";
import {getCachedIcon} from "./icon-cache";

// Icons are authored as square artwork (viewBox="0 0 100 100"), so the body renders as a
// fixed square regardless of hole-to-hole distance; only the leads stretch to fill the rest.
const BODY_SIZE = 32;
const MIN_LEAD_LENGTH = 6;
const LEAD_COLOR = "#cbd5e1";
const LEAD_WIDTH = 3;

export interface DrawStandardComponentOptions {
  selected?: boolean;
  ghost?: boolean;
}

export function drawStandardComponentBody(startDot: IDot, endDot: IDot, def: ComponentDefinition, options: DrawStandardComponentOptions = {}) {
  const dx = endDot.x - startDot.x;
  const dy = endDot.y - startDot.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return;
  const angle = Math.atan2(dy, dx);

  // Body stays a fixed square; leads stretch to fill whatever's left between the two dots.
  const bodySize = Math.max(4, Math.min(BODY_SIZE, length - MIN_LEAD_LENGTH * 2));
  const bodyStart = (length - bodySize) / 2;
  const bodyEnd = bodyStart + bodySize;

  Canvas.ctx.save();
  Canvas.ctx.translate(startDot.x, startDot.y);
  Canvas.ctx.rotate(angle);

  if (options.ghost) {
    Canvas.ctx.globalAlpha = 0.55;
    Canvas.ctx.setLineDash([6, 4]);
  }

  Canvas.ctx.strokeStyle = options.selected ? "#38bdf8" : LEAD_COLOR;
  Canvas.ctx.lineWidth = LEAD_WIDTH;
  Canvas.ctx.lineCap = "round";
  Canvas.ctx.beginPath();
  if (bodyStart > 0) {
    Canvas.ctx.moveTo(0, 0);
    Canvas.ctx.lineTo(bodyStart, 0);
  }
  if (bodyEnd < length) {
    Canvas.ctx.moveTo(bodyEnd, 0);
    Canvas.ctx.lineTo(length, 0);
  }
  Canvas.ctx.stroke();

  const icon = getCachedIcon(getIconPath(def));
  if (icon.loaded && !icon.failed) {
    Canvas.ctx.drawImage(icon.img, bodyStart, -bodySize / 2, bodySize, bodySize);
  } else {
    drawFallbackCapsule(bodyStart, bodySize, def.fallbackLabel, options.selected);
  }

  Canvas.ctx.restore();
}

function drawFallbackCapsule(bodyStart: number, bodySize: number, label: string, selected?: boolean) {
  const halfSize = bodySize / 2;

  Canvas.ctx.beginPath();
  Canvas.ctx.fillStyle = selected ? "rgba(30,58,138,0.9)" : "rgba(17,24,39,0.85)";
  Canvas.ctx.strokeStyle = selected ? "#38bdf8" : "#475569";
  Canvas.ctx.lineWidth = selected ? 3 : 2;
  Canvas.ctx.rect(bodyStart, -halfSize, bodySize, bodySize);
  Canvas.ctx.fill();
  Canvas.ctx.stroke();

  Canvas.ctx.fillStyle = "#ffffff";
  Canvas.ctx.font = "bold 11px Inter, Arial";
  Canvas.ctx.textAlign = "center";
  Canvas.ctx.textBaseline = "middle";
  Canvas.ctx.fillText(label, bodyStart + bodySize / 2, 1);
}
