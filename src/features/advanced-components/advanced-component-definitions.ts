import {ComponentUnit} from "../standard-components/component-definitions";

export interface PinOffset {
  dx: number;
  dy: number;
}

// Pin offsets are in grid units (multiples of GridConfig.dotSpace), relative to pins[0],
// which is always the anchor dot the component is placed on. Unlike the flexible-lead
// components, these pins are rigid: their spacing is fixed by the physical part, not
// chosen by the user, so placement only needs an anchor point + rotation.
export interface AdvancedComponentDefinition {
  id: string;
  category: string;
  name: string;
  iconPath?: string;
  fallbackLabel: string;
  pinOffsets: PinOffset[];
  // Grid holes the body physically covers but that aren't real electrical pins (e.g. the
  // skipped holes of a full-size potentiometer's wider leg spacing). Drawn dimmed, never
  // returned by getPinPositions.
  shadedOffsets?: PinOffset[];
  // Closed polygon (grid units, unrotated) tracing the body's outline for parts whose
  // physical package isn't just a box around its pins. Rotates along with the pins.
  // Falls back to a padded rectangle around the pins when omitted.
  bodyOutline?: PinOffset[];
  // Where to center the icon/fallback label when bodyOutline makes the pin/shaded-hole
  // bounding box a poor stand-in for "the middle of the part" (e.g. a pot's wide flange).
  iconOffset?: PinOffset;
  iconSize?: number;
  unit?: ComponentUnit;
  // When true, the icon is scaled to fill the full body box (rather than padded within it)
  // and, once it has loaded, the body's solid color fill is skipped entirely so only the
  // icon's own artwork is visible. Only sensible when bodyOutline's aspect ratio matches the
  // icon's own aspect ratio, otherwise the icon will over/undershoot the box on one axis.
  iconFillsBody?: boolean;
}

export function getAdvancedIconPath(def: AdvancedComponentDefinition): string {
  return def.iconPath ?? `/icons/components/${def.id}.svg`;
}

const INLINE_3_PINS: PinOffset[] = [{dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: 2, dy: 0}];
// A TO-92's body sits over the middle pin only, with its outer legs splayed out to pins 1
// and 3, so the box has to span the whole pin row (plus a tenth of a hole either side, for
// the lead tips to land on the outer pin centers rather than stop short of them). The
// resulting 2.2 x 0.48 aspect ratio matches transistor.svg's viewBox, so iconFillsBody
// stretches the artwork without distorting it.
const TRANSISTOR_HALF_HEIGHT = 0.24;
const TRANSISTOR_OVERHANG = 0.1;
const TRANSISTOR_BODY_OUTLINE: PinOffset[] = [
  {dx: 0 - TRANSISTOR_OVERHANG, dy: -TRANSISTOR_HALF_HEIGHT},
  {dx: 2 + TRANSISTOR_OVERHANG, dy: -TRANSISTOR_HALF_HEIGHT},
  {dx: 2 + TRANSISTOR_OVERHANG, dy: TRANSISTOR_HALF_HEIGHT},
  {dx: 0 - TRANSISTOR_OVERHANG, dy: TRANSISTOR_HALF_HEIGHT},
];
const Y_3_PINS: PinOffset[] = [{dx: 0, dy: 0}, {dx: 2, dy: 0}, {dx: 1, dy: -1}];
// Some parts (full-size potentiometers, MOSFETs) space their 3 legs one hole apart, so on
// the perfboard grid they land on holes 1/3/5 - holes 2/4 sit under the body but aren't
// connected to anything.
const WIDE_INLINE_3_PINS: PinOffset[] = [{dx: 0, dy: 0}, {dx: 2, dy: 0}, {dx: 4, dy: 0}];
const WIDE_INLINE_3_SHADED: PinOffset[] = [{dx: 1, dy: 0}, {dx: 3, dy: 0}];
// Body box centered on pins 1-3, stopping just shy of the holes either side of the outer
// pins so those stay fully visible, and no taller than the pin row needs - real TO-220
// MOSFETs read as long and thin, not square. The box's 3.9 x 0.92 aspect ratio matches
// mosfet.svg's viewBox, so iconFillsBody stretches the artwork without distorting it.
const MOSFET_HALF_HEIGHT = 0.46;
const MOSFET_OVERHANG = 0.95;
const MOSFET_BODY_OUTLINE: PinOffset[] = [
  {dx: 0 - MOSFET_OVERHANG, dy: -MOSFET_HALF_HEIGHT},
  {dx: 2 + MOSFET_OVERHANG, dy: -MOSFET_HALF_HEIGHT},
  {dx: 2 + MOSFET_OVERHANG, dy: MOSFET_HALF_HEIGHT},
  {dx: 0 - MOSFET_OVERHANG, dy: MOSFET_HALF_HEIGHT},
];
// Physical footprint: a 5-hole-wide, 2-hole-tall flange (the pins sit on its bottom edge),
// with a narrower 3-hole-wide, 3-hole-long bushing/shaft tab hanging off its middle.
const POT_OUTLINE_PAD = 0.3;
const POT_BODY_OUTLINE: PinOffset[] = [
  {dx: 0 - POT_OUTLINE_PAD, dy: -1 - POT_OUTLINE_PAD},
  {dx: 4 + POT_OUTLINE_PAD, dy: -1 - POT_OUTLINE_PAD},
  {dx: 4 + POT_OUTLINE_PAD, dy: 0 + POT_OUTLINE_PAD},
  {dx: 3 + POT_OUTLINE_PAD, dy: 0 + POT_OUTLINE_PAD},
  {dx: 3 + POT_OUTLINE_PAD, dy: 2 + POT_OUTLINE_PAD},
  {dx: 1 - POT_OUTLINE_PAD, dy: 2 + POT_OUTLINE_PAD},
  {dx: 1 - POT_OUTLINE_PAD, dy: 0 + POT_OUTLINE_PAD},
  {dx: 0 - POT_OUTLINE_PAD, dy: 0 + POT_OUTLINE_PAD},
];

export const ADVANCED_COMPONENT_DEFINITIONS: AdvancedComponentDefinition[] = [
  {
    id: "transistor", category: "Semiconductor", name: "Transistor", fallbackLabel: "Q",
    pinOffsets: INLINE_3_PINS,
    bodyOutline: TRANSISTOR_BODY_OUTLINE, iconFillsBody: true
  },
  {
    id: "mosfet", category: "Semiconductor", name: "MOSFET", fallbackLabel: "MOS",
    pinOffsets: INLINE_3_PINS,
    bodyOutline: MOSFET_BODY_OUTLINE, iconFillsBody: true
  },
  {
    id: "potentiometer", category: "Passive", name: "Potentiometer", fallbackLabel: "POT",
    pinOffsets: WIDE_INLINE_3_PINS, shadedOffsets: WIDE_INLINE_3_SHADED, bodyOutline: POT_BODY_OUTLINE,
    iconOffset: {dx: 2, dy: -0.5}, iconSize: 60, unit: "Ω"
  },
  {id: "trim-potentiometer-inline", category: "Passive", name: "Trim Potentiometer (Inline)", fallbackLabel: "TRIM", pinOffsets: INLINE_3_PINS, unit: "Ω"},
  {id: "trim-potentiometer-y", category: "Passive", name: "Trim Potentiometer (Y)", fallbackLabel: "TRIM-Y", pinOffsets: Y_3_PINS, unit: "Ω"},
];

export function getAdvancedComponentDefinition(id: string): AdvancedComponentDefinition | undefined {
  return ADVANCED_COMPONENT_DEFINITIONS.find(def => def.id === id);
}
