import {COMPONENT_ICON_DIR, ComponentUnit} from "../standard-components/component-definitions";
import {CategoryId} from "../catalog/catalog-categories";

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
  // Where the part is listed in the Components panel tree (see catalog-categories.ts).
  category: CategoryId;
  name: string;
  // Extra search terms (abbreviations, part families) that don't appear in `name`.
  keywords?: string[];
  // Letters of a placed part's reference designator: "Q" makes Q1, Q2...
  refPrefix: string;
  iconPath?: string;
  fallbackLabel: string;
  pinOffsets: PinOffset[];
  pinLabels?: string[];
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
  // Overrides where the pin number labels sit relative to each pin (grid units, unrotated,
  // negative dy = above the pin row). Needed for parts whose body covers the default spot
  // just above the pin - the numbers get pushed clear of the body instead of onto it.
  pinLabelOffset?: PinOffset;
  // Where to center the value label on the part itself (grid units, unrotated, relative to
  // pins[0]), for packages with a spot that reads like silkscreen (e.g. a MOSFET's black
  // body). Parts without it get their value label next to the body instead.
  valueLabelOffset?: PinOffset;
  unit?: ComponentUnit;
  // The value prompt still normalizes anything that parses as a `unit` quantity (so "10k"
  // becomes "10kΩ"), but keeps any other text as typed instead of rejecting it. For parts whose
  // real-world marking isn't a bare number, e.g. a pot's taper code ("B10K", "A100K").
  freeFormValue?: boolean;
  // When true, the icon is scaled to fill the full body box (rather than padded within it)
  // and, once it has loaded, the body's solid color fill is skipped entirely so only the
  // icon's own artwork is visible. Only sensible when bodyOutline's aspect ratio matches the
  // icon's own aspect ratio, otherwise the icon will over/undershoot the box on one axis.
  iconFillsBody?: boolean;
  // The part's pin count isn't fixed by the package: the user drags out a rows x cols block of
  // pins at placement time (header pins). pinOffsets then only holds the 1x1 default - the real
  // lattice lives on the placed instance's rows/cols.
  gridSizable?: boolean;
  // The icon is the artwork for a *single* pin, tiled once per pin at exactly one grid pitch,
  // rather than one image stretched across the whole body. Implies no body box, no pin markers
  // and no pin numbers - the tiles themselves are the part.
  perPinIcon?: boolean;
}

// Half-extent (grid units) of one perPinIcon tile. At 0.5 a tile is exactly one grid pitch
// wide, so neighbouring pins butt together into a continuous strip with no seam.
export const PIN_TILE_HALF = 0.5;

export function getAdvancedIconPath(def: AdvancedComponentDefinition): string {
  return def.iconPath ?? `${COMPONENT_ICON_DIR}${def.id}.svg`;
}

const INLINE_3_PINS: PinOffset[] = [{dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: 2, dy: 0}];
// A TO-92's body sits over the middle pin only, with its outer legs splayed out to pins 1
// and 3, so the box has to span the whole pin row (plus a tenth of a hole either side, for
// the lead tips to land on the outer pin centers rather than stop short of them). The
// resulting 2.2 x 0.88 aspect ratio matches transistor.svg's viewBox, so iconFillsBody
// stretches the artwork without distorting it. The box is taller than the leads need so
// the (much larger) package artwork fits inside it at the icon's own proportions.
const TRANSISTOR_HALF_HEIGHT = 0.44;
const TRANSISTOR_OVERHANG = 0.1;
const TRANSISTOR_BODY_OUTLINE: PinOffset[] = [
  {dx: 0 - TRANSISTOR_OVERHANG, dy: -TRANSISTOR_HALF_HEIGHT},
  {dx: 2 + TRANSISTOR_OVERHANG, dy: -TRANSISTOR_HALF_HEIGHT},
  {dx: 2 + TRANSISTOR_OVERHANG, dy: TRANSISTOR_HALF_HEIGHT},
  {dx: 0 - TRANSISTOR_OVERHANG, dy: TRANSISTOR_HALF_HEIGHT},
];
// The package now reaches nearly the full half-height above the pin row, so the numbers
// have to clear it to sit on the board rather than on the artwork.
const TRANSISTOR_PIN_LABEL_OFFSET: PinOffset = {dx: 0, dy: -(TRANSISTOR_HALF_HEIGHT + 0.24)};
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
// The body reaches MOSFET_HALF_HEIGHT above the pin row, so the numbers have to clear that
// (plus a little breathing room) to sit on the board rather than on the package artwork.
const MOSFET_PIN_LABEL_OFFSET: PinOffset = {dx: 0, dy: -(MOSFET_HALF_HEIGHT + 0.24)};
// Middle of mosfet.svg's black plastic, between the metal tab's edge (viewBox y=17) and the
// bottom outline (y=40), out of a 46-tall viewBox mapped onto the body's height.
const MOSFET_VALUE_LABEL_OFFSET: PinOffset = {dx: 1, dy: ((17 + 40) / 2 - 23) / 46 * (MOSFET_HALF_HEIGHT * 2)};
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

// Center of POT_BODY_OUTLINE's bounding box (x -0.3..4.3, y -1.3..2.3), which iconFillsBody
// stretches potentiometer.svg across. That box's 4.6 x 3.6 ratio matches the SVG's viewBox.
const POT_ICON_CENTER: PinOffset = {dx: 2, dy: 0.5};

function rectangularOutline(left: number, top: number, right: number, bottom: number): PinOffset[] {
  return [{dx: left, dy: top}, {dx: right, dy: top}, {dx: right, dy: bottom}, {dx: left, dy: bottom}];
}

const RGB_LED_PINS: PinOffset[] = [...INLINE_3_PINS, {dx: 3, dy: 0}];
const RGB_LED_OUTLINE = rectangularOutline(-0.2, -1.16, 3.2, 1.16);

// DIP switch: two rows 7.62 mm (3 holes) apart, numbered like a DIP IC - pins 1..n left to
// right along the bottom row, then n+1..2n right to left along the top - so switch k joins
// pin k and the pin straight above it. The ~9.9 mm housing covers both rows.
function dipSwitchPins(positions: number): PinOffset[] {
  const bottom = Array.from({length: positions}, (_, i) => ({dx: i, dy: 0}));
  const top = Array.from({length: positions}, (_, i) => ({dx: positions - 1 - i, dy: -3}));
  return [...bottom, ...top];
}
function dipSwitchOutline(positions: number): PinOffset[] {
  return rectangularOutline(-0.6, -3.47, positions - 0.4, 0.47);
}

// 0.56" single-digit display (Kingbright SA56-11 / SC56-11): rows 15.24 mm (6 holes) apart,
// each 1.905 mm in from the 12.5 × 19.05 mm body's edge. Pins 1-5 run left to right along the
// bottom, 6-10 right to left along the top; pins 3 and 8 are the common.
const SEVEN_SEGMENT_PINS: PinOffset[] = [
  {dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: 2, dy: 0}, {dx: 3, dy: 0}, {dx: 4, dy: 0},
  {dx: 4, dy: -6}, {dx: 3, dy: -6}, {dx: 2, dy: -6}, {dx: 1, dy: -6}, {dx: 0, dy: -6},
];
const SEVEN_SEGMENT_OUTLINE = rectangularOutline(-0.46, -6.75, 4.46, 0.75);
function sevenSegmentLabels(common: string): string[] {
  return ["E", "D", common, "C", "DP", "B", "A", common, "F", "G"];
}

export const ADVANCED_COMPONENT_DEFINITIONS: AdvancedComponentDefinition[] = [
  {
    id: "transistor", refPrefix: "Q", category: "semiconductors.transistors", name: "Transistor (TO-92)", fallbackLabel: "Q",
    keywords: ["bjt", "npn", "pnp", "to-92", "2n2222", "bc547"],
    pinOffsets: INLINE_3_PINS,
    bodyOutline: TRANSISTOR_BODY_OUTLINE, iconFillsBody: true,
    pinLabelOffset: TRANSISTOR_PIN_LABEL_OFFSET
  },
  {
    id: "mosfet", refPrefix: "Q", category: "semiconductors.transistors", name: "MOSFET (TO-220)", fallbackLabel: "MOS",
    keywords: ["fet", "to-220", "irf"],
    pinOffsets: INLINE_3_PINS,
    bodyOutline: MOSFET_BODY_OUTLINE, iconFillsBody: true,
    pinLabelOffset: MOSFET_PIN_LABEL_OFFSET, valueLabelOffset: MOSFET_VALUE_LABEL_OFFSET
  },
  {
    id: "potentiometer", refPrefix: "RV", category: "passives.resistors", name: "Potentiometer", fallbackLabel: "POT",
    keywords: ["pot", "variable resistor", "trimmer", "knob"],
    pinOffsets: WIDE_INLINE_3_PINS, shadedOffsets: WIDE_INLINE_3_SHADED, bodyOutline: POT_BODY_OUTLINE,
    iconOffset: POT_ICON_CENTER, iconFillsBody: true, unit: "Ω", freeFormValue: true
  },
  {
    id: "header-pins", refPrefix: "J", category: "connectors", name: "Header Pins", fallbackLabel: "HDR",
    keywords: ["header", "pin header", "jumper", "dupont"],
    // Only the 1x1 default lives here - the real lattice is the placed instance's rows/cols.
    pinOffsets: [{dx: 0, dy: 0}],
    gridSizable: true, perPinIcon: true
  },
  {
    id: "screw-terminal-2", refPrefix: "J", category: "connectors", name: "Screw Terminal (2-pin, 5.08 mm)", fallbackLabel: "TB2",
    keywords: ["terminal block", "power input", "connector", "wire"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 2, dy: 0}],
    bodyOutline: rectangularOutline(-1, -1.6, 3, 1.6), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -1.9}
  },
  {
    id: "screw-terminal-3", refPrefix: "J", category: "connectors", name: "Screw Terminal (3-pin, 5.08 mm)", fallbackLabel: "TB3",
    keywords: ["terminal block", "power input", "connector", "wire"],
    pinOffsets: WIDE_INLINE_3_PINS,
    bodyOutline: rectangularOutline(-1, -1.6, 5, 1.6), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -1.9}
  },
  {
    id: "push-button", refPrefix: "SW", category: "switches", name: "Push Button (KSA, 7.62 × 5.08 mm)", fallbackLabel: "BTN",
    keywords: ["tactile", "momentary", "normally open", "spst", "ksa0m"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 3, dy: 0}, {dx: 3, dy: 2}, {dx: 0, dy: 2}],
    bodyOutline: rectangularOutline(-0.27, -0.5, 3.27, 2.5), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -0.8}
  },
  {
    id: "slide-switch", refPrefix: "SW", category: "switches", name: "Slide Switch (SPDT, formed 2.54 mm)", fallbackLabel: "SPDT",
    keywords: ["on on", "selector", "js102011cqn", "switch"],
    pinOffsets: INLINE_3_PINS, pinLabels: ["1", "COM", "3"],
    bodyOutline: rectangularOutline(-0.67, -0.69, 2.67, 0.69), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -1}
  },
  {
    id: "regulator-7805", refPrefix: "U", category: "ics.power", name: "7805 Voltage Regulator (TO-220)", fallbackLabel: "7805",
    keywords: ["lm7805", "lm340", "5v", "linear", "power supply"],
    iconPath: `${COMPONENT_ICON_DIR}mosfet.svg`,
    pinOffsets: INLINE_3_PINS, pinLabels: ["IN", "GND", "OUT"],
    bodyOutline: MOSFET_BODY_OUTLINE, iconFillsBody: true,
    pinLabelOffset: MOSFET_PIN_LABEL_OFFSET, valueLabelOffset: MOSFET_VALUE_LABEL_OFFSET
  },
  {
    id: "regulator-lm317", refPrefix: "U", category: "ics.power", name: "LM317 Adjustable Regulator (TO-220)", fallbackLabel: "LM317",
    keywords: ["voltage regulator", "linear", "power supply", "adjustable"],
    iconPath: `${COMPONENT_ICON_DIR}mosfet.svg`,
    pinOffsets: INLINE_3_PINS, pinLabels: ["ADJ", "OUT", "IN"],
    bodyOutline: MOSFET_BODY_OUTLINE, iconFillsBody: true,
    pinLabelOffset: MOSFET_PIN_LABEL_OFFSET, valueLabelOffset: MOSFET_VALUE_LABEL_OFFSET
  },
  {
    id: "trimmer", refPrefix: "RV", category: "passives.resistors", name: "Trimmer Potentiometer (3296W)", fallbackLabel: "TRIM",
    keywords: ["trimpot", "preset", "multiturn", "variable resistor", "adjustment"],
    pinOffsets: INLINE_3_PINS, pinLabels: ["CCW", "W", "CW"],
    bodyOutline: rectangularOutline(-0.88, -0.95, 2.88, 0.95), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -1.25}, unit: "Ω", freeFormValue: true
  },
  {
    id: "female-header", refPrefix: "J", category: "connectors", name: "Female Header (2.54 mm)", fallbackLabel: "SOCK",
    keywords: ["socket", "female pins", "receptacle", "dupont", "module"],
    pinOffsets: [{dx: 0, dy: 0}], gridSizable: true, perPinIcon: true
  },
  {
    id: "jumper-cap", refPrefix: "JP", category: "connectors", name: "Jumper Cap (2.54 mm)", fallbackLabel: "JP",
    keywords: ["shunt", "bridge", "jumper", "header"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 1, dy: 0}],
    bodyOutline: rectangularOutline(-0.5, -0.5, 1.5, 0.5), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -0.8}
  },
  {
    id: "buzzer", refPrefix: "BZ", category: "outputs", name: "Buzzer (12 mm, formed 5.08 mm)", fallbackLabel: "BZ",
    keywords: ["audio", "sound", "alarm", "magnetic", "transducer", "cem-1206s"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 2, dy: 0}], pinLabels: ["+", "−"],
    bodyOutline: rectangularOutline(-1.36, -2.36, 3.36, 2.36), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -2.65}
  },
  {
    id: "relay-dpdt", refPrefix: "K", category: "outputs", name: "Relay (G5V-2, DPDT)", fallbackLabel: "RELAY",
    keywords: ["coil", "signal", "normally open", "normally closed", "omron"],
    pinOffsets: [
      {dx: 0, dy: 0}, {dx: 3, dy: 0}, {dx: 5, dy: 0}, {dx: 7, dy: 0},
      {dx: 7, dy: -3}, {dx: 5, dy: -3}, {dx: 3, dy: -3}, {dx: 0, dy: -3}
    ],
    pinLabels: ["1 COIL", "4 COM", "6 NC", "8 NO", "9 NO", "11 NC", "13 COM", "16 COIL"],
    bodyOutline: rectangularOutline(-0.535, -3.488, 7.535, 0.488),
    iconOffset: {dx: 3.5, dy: -1.5}, iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -0.8}
  },
  {
    id: "rgb-led-cathode", refPrefix: "D", category: "semiconductors.diodes", name: "RGB LED (Common Cathode, formed 2.54 mm)", fallbackLabel: "RGB−",
    keywords: ["light", "red green blue", "5mm", "indicator", "cc"],
    iconPath: `${COMPONENT_ICON_DIR}rgb-led.svg`,
    pinOffsets: RGB_LED_PINS, pinLabels: ["R", "K", "G", "B"],
    bodyOutline: RGB_LED_OUTLINE, iconFillsBody: true, pinLabelOffset: {dx: 0, dy: -1.45}
  },
  {
    id: "rgb-led-anode", refPrefix: "D", category: "semiconductors.diodes", name: "RGB LED (Common Anode, formed 2.54 mm)", fallbackLabel: "RGB+",
    keywords: ["light", "red green blue", "5mm", "indicator", "ca"],
    iconPath: `${COMPONENT_ICON_DIR}rgb-led.svg`,
    pinOffsets: RGB_LED_PINS, pinLabels: ["R", "A", "G", "B"],
    bodyOutline: RGB_LED_OUTLINE, iconFillsBody: true, pinLabelOffset: {dx: 0, dy: -1.45}
  },
  {
    id: "crystal-hc49", refPrefix: "Y", category: "passives.timing", name: "Quartz Crystal (HC-49/US, formed 5.08 mm)", fallbackLabel: "XTAL",
    keywords: ["crystal", "quartz", "oscillator", "clock", "frequency", "mhz"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 2, dy: 0}],
    bodyOutline: rectangularOutline(-1.234, -0.915, 3.234, 0.915), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -1.22}, freeFormValue: true
  },
  {
    id: "ceramic-resonator", refPrefix: "Y", category: "passives.timing", name: "Ceramic Resonator (CSTLS, formed 2.54 mm)", fallbackLabel: "RES",
    keywords: ["clock", "oscillator", "frequency", "murata", "cstls4m00g53", "mhz"],
    pinOffsets: INLINE_3_PINS, pinLabels: ["OUT", "GND", "IN"],
    bodyOutline: rectangularOutline(-0.575, -0.591, 2.575, 0.591), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -0.9}, freeFormValue: true
  },
  {
    id: "ldr", refPrefix: "R", category: "passives.resistors", name: "Photoresistor (PDV-P8103, formed 5.08 mm)", fallbackLabel: "LDR",
    keywords: ["ldr", "light dependent resistor", "photocell", "sensor", "cds"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 2, dy: 0}],
    bodyOutline: rectangularOutline(-0.004, -1.004, 2.004, 1.004), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -1.3}, unit: "Ω", freeFormValue: true
  },
  {
    id: "thermistor", refPrefix: "RT", category: "passives.resistors", name: "NTC Thermistor (NTCLE100E3, 2.54 mm)", fallbackLabel: "NTC",
    keywords: ["temperature", "sensor", "negative temperature coefficient", "thermal", "vishay"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 1, dy: 0}],
    bodyOutline: rectangularOutline(-0.248, -0.591, 1.248, 0.591), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -0.9}, unit: "Ω", freeFormValue: true
  },
  {
    id: "film-capacitor", refPrefix: "C", category: "passives.capacitors", name: "Film Capacitor (MKS 2, formed 5.08 mm)", fallbackLabel: "FILM",
    keywords: ["polyester", "pet", "box", "nonpolar", "wima", "capacitor"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 2, dy: 0}],
    bodyOutline: rectangularOutline(-0.417, -0.492, 2.417, 0.492), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -0.8}, unit: "F"
  },
  // The housing hides both pin rows, so the numbers sit on the pins themselves.
  ...[2, 4, 8].map((positions): AdvancedComponentDefinition => ({
    id: `dip-switch-${positions}`, refPrefix: "SW", category: "switches",
    name: `DIP Switch (${positions}-position)`, fallbackLabel: `DIP${positions}`,
    keywords: ["dip switch", "configuration", "address", "spst", "piano", "cts 206"],
    pinOffsets: dipSwitchPins(positions),
    bodyOutline: dipSwitchOutline(positions), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: 0}
  })),
  {
    id: "seven-segment-cc", refPrefix: "DS", category: "displays", name: "7-Segment Display (Common Cathode, 0.56\")", fallbackLabel: "8.",
    keywords: ["seven segment", "7seg", "led display", "digit", "numeric", "sc56-11", "5161as", "cc"],
    iconPath: `${COMPONENT_ICON_DIR}seven-segment.svg`,
    pinOffsets: SEVEN_SEGMENT_PINS, pinLabels: sevenSegmentLabels("CC"),
    bodyOutline: SEVEN_SEGMENT_OUTLINE, iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: 0}
  },
  {
    id: "seven-segment-ca", refPrefix: "DS", category: "displays", name: "7-Segment Display (Common Anode, 0.56\")", fallbackLabel: "8.",
    keywords: ["seven segment", "7seg", "led display", "digit", "numeric", "sa56-11", "5161bs", "ca"],
    iconPath: `${COMPONENT_ICON_DIR}seven-segment.svg`,
    pinOffsets: SEVEN_SEGMENT_PINS, pinLabels: sevenSegmentLabels("CA"),
    bodyOutline: SEVEN_SEGMENT_OUTLINE, iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: 0}
  },
  {
    // Schurter OGN 0031.8201: 22.5 mm pin distance, which lands within 0.2 mm of a hole at
    // each end of a 9-hole (22.86 mm) span.
    id: "fuse-holder", refPrefix: "F", category: "passives.protection", name: "Fuse Holder (5×20 mm, OGN, 9-hole span)", fallbackLabel: "FUSE",
    keywords: ["fuse", "fuseholder", "5x20", "glass fuse", "schurter", "protection", "overcurrent"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 9, dy: 0}],
    bodyOutline: rectangularOutline(-0.6, -0.95, 9.6, 0.95), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: -1.25}, freeFormValue: true
  },
  {
    // Bourns PEC11R-4xxxF-S: A/C/B at 2.5 mm pitch and the push switch's two pins on the far
    // side, 14.5 mm away, formed to 2.54 mm and a 6-hole (15.24 mm) row spacing. The two wide
    // mounting lugs between the rows don't fit perfboard holes and aren't drawn.
    id: "rotary-encoder", refPrefix: "SW", category: "switches", name: "Rotary Encoder (PEC11R, push switch, formed)", fallbackLabel: "ENC",
    keywords: ["encoder", "incremental", "quadrature", "knob", "menu", "volume", "ec11", "bourns"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 1, dy: 0}, {dx: 2, dy: 0}, {dx: 0, dy: -6}, {dx: 2, dy: -6}],
    pinLabels: ["A", "C", "B", "S1", "S2"],
    bodyOutline: rectangularOutline(-1.46, -5.64, 3.46, -0.36), iconFillsBody: true,
    pinLabelOffset: {dx: 0, dy: 0.5}
  },
  {
    // 5.5 × 2.1 mm jack with thin breadboard-friendly pins (SparkFun PRT-10811, 4UCON 18742),
    // opening to the right. Its pins sit 5.8 mm apart along the barrel with the switch pin
    // 4.8 mm to the side, formed to 2 holes along and 2 across.
    id: "dc-barrel-jack", refPrefix: "J", category: "connectors", name: "DC Barrel Jack (5.5 × 2.1 mm, formed)", fallbackLabel: "DC",
    keywords: ["power jack", "dc jack", "barrel", "power input", "wall adapter", "2.1mm", "5.5mm"],
    pinOffsets: [{dx: 0, dy: 0}, {dx: 2, dy: 0}, {dx: 1, dy: -2}],
    pinLabels: ["CTR", "SLV", "SW"],
    bodyOutline: rectangularOutline(-0.354, -1.772, 5.354, 1.772),
    iconOffset: {dx: 2.5, dy: 0}, iconFillsBody: true
  },
];

export function getAdvancedComponentDefinition(id: string): AdvancedComponentDefinition | undefined {
  return ADVANCED_COMPONENT_DEFINITIONS.find(def => def.id === id);
}
