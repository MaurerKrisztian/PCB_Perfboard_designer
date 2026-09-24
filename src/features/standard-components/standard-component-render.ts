import {Canvas} from "../../state/Canvas";
import {IDot} from "../../interfaces/dot.interface";
import {ComponentDefinition, getComponentBodySize, getIconPath} from "./component-definitions";
import {getCachedIcon} from "./icon-cache";
import {parseComponentValue} from "./component-value";
import {getCeramicCapacitorCode, getResistorBandColors} from "./component-value-codes";

// Icons are authored as square artwork (viewBox="0 0 100 100"), so the body renders as a
// fixed square regardless of hole-to-hole distance; only the leads stretch to fill the rest.
// Bodies are deliberately larger than one grid step, so on short spans they cover the dots
// they sit between and no lead is drawn at all.
const LEAD_COLOR = "#cbd5e1";
// Lead weight tracks the body so bigger parts don't end up with hairline leads: 4px at the
// 64px default body, matching the 4-viewBox-unit outline the icons are drawn with.
const LEAD_WIDTH_RATIO = 4 / 64;
// The icons leave a transparent margin inside their 100x100 viewBox (the resistor body starts
// at x=7, the LED's flat cathode edge at x=8), so a lead stopping at the body box would leave
// a green sliver before the artwork begins. Leads run this far past the box edge instead; the
// body is drawn over them afterwards, so the overlap never shows.
const LEAD_BODY_OVERLAP_RATIO = 0.12;

export interface DrawStandardComponentOptions {
  selected?: boolean;
  ghost?: boolean;
  value?: string;
  color?: string;
}

export function drawStandardComponentBody(startDot: IDot, endDot: IDot, def: ComponentDefinition, options: DrawStandardComponentOptions = {}) {
  const dx = endDot.x - startDot.x;
  const dy = endDot.y - startDot.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length === 0) return;
  const angle = Math.atan2(dy, dx);

  // Body stays a fixed square; leads stretch to fill whatever's left between the two dots
  // (and are skipped entirely when the body is longer than the span).
  const bodySize = getComponentBodySize(def);
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
  Canvas.ctx.lineWidth = bodySize * LEAD_WIDTH_RATIO;
  Canvas.ctx.lineCap = "round";
  Canvas.ctx.beginPath();
  const leadOverlap = bodySize * LEAD_BODY_OVERLAP_RATIO;
  if (bodyStart > 0) {
    Canvas.ctx.moveTo(0, 0);
    Canvas.ctx.lineTo(bodyStart + leadOverlap, 0);
  }
  if (bodyEnd < length) {
    Canvas.ctx.moveTo(bodyEnd - leadOverlap, 0);
    Canvas.ctx.lineTo(length, 0);
  }
  Canvas.ctx.stroke();

  const icon = getCachedIcon(getIconPath(def));
  if (icon.loaded && !icon.failed) {
    Canvas.ctx.drawImage(icon.img, bodyStart, -bodySize / 2, bodySize, bodySize);
    if (options.value) {
      drawValueOverlay(def, options.value, bodyStart, bodySize);
    }
    if (def.id === "led" && options.color) {
      drawLedColorOverlay(options.color, bodyStart, bodySize);
    }
  } else {
    drawFallbackCapsule(bodyStart, bodySize, def.fallbackLabel, options.selected);
  }

  Canvas.ctx.restore();
}

// Same x-slots as the 4 static decorative bands already baked into resistor.svg's raster,
// widened/heightened by a small margin (still centered on the same slot) so they fully
// cover the decorative bands underneath instead of leaving a sliver visible at the edges.
const RESISTOR_BAND_X = [19.5, 34.3, 49, 71.5]; // viewBox units, decorative band left edge
const RESISTOR_BAND_BASE_WIDTH = 5.6; // viewBox units, decorative band width
const RESISTOR_BAND_MARGIN = 1.2; // viewBox units added on each side
const RESISTOR_BAND_WIDTH = RESISTOR_BAND_BASE_WIDTH + RESISTOR_BAND_MARGIN * 2;
const RESISTOR_BAND_VIEWBOX_HEIGHT = 26; // slightly taller than the body's 40..60 span

const CERAMIC_CODE_COLOR = "#3a2410";
// Scales with the body so the code keeps the same proportions on any body size.
const CERAMIC_CODE_FONT_RATIO = 0.4;

function drawValueOverlay(def: ComponentDefinition, value: string, bodyStart: number, bodySize: number) {
  // Gated on def.id, not def.unit - electrolytic-capacitor also has unit "F" but must stay untouched.
  if (def.id === "resistor") {
    drawResistorBands(value, bodyStart, bodySize);
  } else if (def.id === "ceramic-capacitor") {
    drawCeramicCapacitorCode(value, bodyStart, bodySize);
  }
}

function drawResistorBands(value: string, bodyStart: number, bodySize: number) {
  const ohms = parseComponentValue(value, "Ω");
  if (ohms === undefined || ohms <= 0) return;
  const bandColors = getResistorBandColors(ohms);
  if (!bandColors) return; // outside representable range - leave the icon's baked-in bands as-is

  const scale = bodySize / 100;
  const colors = [bandColors.digit1, bandColors.digit2, bandColors.multiplier, bandColors.tolerance];
  const bandHeight = RESISTOR_BAND_VIEWBOX_HEIGHT * scale;
  const bandTop = -bandHeight / 2;

  Canvas.ctx.save();
  for (let i = 0; i < RESISTOR_BAND_X.length; i++) {
    Canvas.ctx.fillStyle = colors[i];
    const x = bodyStart + (RESISTOR_BAND_X[i] - RESISTOR_BAND_MARGIN) * scale;
    Canvas.ctx.fillRect(x, bandTop, RESISTOR_BAND_WIDTH * scale, bandHeight);
  }
  Canvas.ctx.restore();
}

function drawCeramicCapacitorCode(value: string, bodyStart: number, bodySize: number) {
  const farads = parseComponentValue(value, "F");
  if (farads === undefined || farads <= 0) return;
  const text = getCeramicCapacitorCode(farads) ?? value;

  Canvas.ctx.save();
  Canvas.ctx.fillStyle = CERAMIC_CODE_COLOR;
  Canvas.ctx.font = `bold ${Math.round(bodySize * CERAMIC_CODE_FONT_RATIO)}px Inter, Arial`;
  Canvas.ctx.textAlign = "center";
  Canvas.ctx.textBaseline = "middle";
  Canvas.ctx.fillText(text, bodyStart + bodySize / 2, bodySize * 0.03);
  Canvas.ctx.restore();
}

// Mirrors the flat-cathode-edge body path baked into led.svg - keep these in sync so the
// color fill lines up with the artwork's silhouette instead of spilling past its edges.
const LED_BODY_PATH = "M8 24.08A46 46 0 1 1 8 75.92Z";
const LED_SOLID_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#facc15",
};
const LED_RGB_STRIPE_COLORS = ["#ef4444", "#22c55e", "#3b82f6"];

function drawLedColorOverlay(color: string, bodyStart: number, bodySize: number) {
  const scale = bodySize / 100;
  Canvas.ctx.save();
  Canvas.ctx.translate(bodyStart, -bodySize / 2);
  Canvas.ctx.scale(scale, scale);
  Canvas.ctx.clip(new Path2D(LED_BODY_PATH));

  if (color === "rgb") {
    const stripeHeight = 100 / LED_RGB_STRIPE_COLORS.length;
    LED_RGB_STRIPE_COLORS.forEach((stripeColor, i) => {
      Canvas.ctx.fillStyle = stripeColor;
      Canvas.ctx.fillRect(0, i * stripeHeight, 100, stripeHeight);
    });
  } else {
    Canvas.ctx.fillStyle = LED_SOLID_COLORS[color] ?? color;
    Canvas.ctx.fillRect(0, 0, 100, 100);
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
