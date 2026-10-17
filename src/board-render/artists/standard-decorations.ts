import {ComponentDefinition} from "../../parts/component-definitions";
import {parseComponentValue} from "../../parts/component-value";
import {getCeramicCapacitorCode, getResistorBandColors} from "../../parts/component-value-codes";
import {SavedStandardComponent} from "../../project-file/project-file";
import {Painter} from "../painter/painter";

// Artwork painted over a flexible-lead part's icon from what the user set on it: a resistor's
// colour bands from its value, a ceramic capacitor's printed code, an LED's colour. Each is drawn
// in the part's own frame (see standard-geometry.ts), over the icon's square box from `bodyStart`.
// One part's special look is one entry in DECORATIONS.

export type Decoration = (painter: Painter, part: SavedStandardComponent, bodyStart: number, bodySize: number) => void;

// Same x-slots as the 4 static decorative bands already baked into resistor.svg's raster,
// widened/heightened by a small margin (still centered on the same slot) so they fully
// cover the decorative bands underneath instead of leaving a sliver visible at the edges.
const RESISTOR_BAND_X = [19.5, 34.3, 49, 71.5]; // viewBox units, decorative band left edge
const RESISTOR_BAND_BASE_WIDTH = 5.6; // viewBox units, decorative band width
const RESISTOR_BAND_MARGIN = 1.2; // viewBox units added on each side
const RESISTOR_BAND_WIDTH = RESISTOR_BAND_BASE_WIDTH + RESISTOR_BAND_MARGIN * 2;
// Mirrors the body path baked into resistor.svg; bands are clipped to it so they span the full body height.
const RESISTOR_BODY_PATH = "M7 62c-5.5-6-5.5-18 0-24 8-7 77-7 85 0 5.5 6 5.5 18 0 24-8 7-77 7-85 0z";

const CERAMIC_CODE_COLOR = "#3a2410";
// Scales with the body so the code keeps the same proportions on any body size.
const CERAMIC_CODE_FONT_RATIO = 0.4;

// Mirrors the flat-cathode-edge body path baked into led.svg - keep these in sync so the
// color fill lines up with the artwork's silhouette instead of spilling past its edges.
const LED_BODY_PATH = "M6 23.47A48 48 0 1 1 6 76.53Z";
export const LED_SOLID_COLORS: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#facc15",
};
const LED_RGB_STRIPE_COLORS = ["#ef4444", "#22c55e", "#3b82f6"];

// Inside the icon's 100x100 viewBox, so paths baked into the artwork can be reused as is.
function inIconUnits(painter: Painter, bodyStart: number, bodySize: number, clip: string, draw: () => void) {
  painter.group({translate: [bodyStart, -bodySize / 2], scale: bodySize / 100, clip}, draw);
}

const resistorBands: Decoration = (painter, part, bodyStart, bodySize) => {
  const ohms = part.value ? parseComponentValue(part.value, "Ω") : undefined;
  if (ohms === undefined || ohms <= 0) return;
  const bands = getResistorBandColors(ohms);
  if (!bands) return; // outside representable range - leave the icon's baked-in bands as-is
  const colors = [bands.digit1, bands.digit2, bands.multiplier, bands.tolerance];
  inIconUnits(painter, bodyStart, bodySize, RESISTOR_BODY_PATH, () => {
    RESISTOR_BAND_X.forEach((x, i) => painter.rect(x - RESISTOR_BAND_MARGIN, 0, RESISTOR_BAND_WIDTH, 100, {fill: colors[i]}));
  });
};

const ceramicCode: Decoration = (painter, part, bodyStart, bodySize) => {
  const farads = part.value ? parseComponentValue(part.value, "F") : undefined;
  if (!part.value || farads === undefined || farads <= 0) return;
  painter.text(getCeramicCapacitorCode(farads) ?? part.value, bodyStart + bodySize / 2, bodySize * 0.03, {
    font: {family: "sans", size: Math.round(bodySize * CERAMIC_CODE_FONT_RATIO), weight: 700},
    color: CERAMIC_CODE_COLOR, align: "center", baseline: "middle",
  });
};

const ledColor: Decoration = (painter, part, bodyStart, bodySize) => {
  const color = part.color;
  if (!color) return;
  inIconUnits(painter, bodyStart, bodySize, LED_BODY_PATH, () => {
    if (color === "rgb") {
      const stripe = 100 / LED_RGB_STRIPE_COLORS.length;
      LED_RGB_STRIPE_COLORS.forEach((stripeColor, i) => painter.rect(0, i * stripe, 100, stripe, {fill: stripeColor}));
    } else {
      painter.rect(0, 0, 100, 100, {fill: LED_SOLID_COLORS[color] ?? color});
    }
  });
};

// By definition id. Electrolytic capacitors share the "F" unit but keep their plain icon.
const DECORATIONS: Record<string, Decoration> = {
  "resistor": resistorBands,
  "ceramic-capacitor": ceramicCode,
};

export function decorationsFor(def: ComponentDefinition): Decoration[] {
  const byId = DECORATIONS[def.id];
  return [...(byId ? [byId] : []), ...(def.led ? [ledColor] : [])];
}
