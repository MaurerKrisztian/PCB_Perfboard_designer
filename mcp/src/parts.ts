import {COMPONENT_DEFINITIONS, ComponentDefinition} from "../../src/features/standard-components/component-definitions";
import {
  ADVANCED_COMPONENT_DEFINITIONS, AdvancedComponentDefinition, PinOffset,
} from "../../src/features/advanced-components/advanced-component-definitions";
import {IC_DEFINITIONS, IcDefinition} from "../../src/features/ic-definitions";
import {CategoryId, getCategoryPath} from "../../src/features/catalog/catalog-categories";
import {isModuleCategory} from "../../src/project-file/ic-package";

// The editor's parts catalog as data for programs: every part a project can place, with what a
// project file entry for it needs and where its pins are. Read straight from the editor's own
// definitions, so it can't drift from them.

export type PartKind = "standard-component" | "advanced-component" | "ic";

interface CatalogPartBase {
  kind: PartKind;
  // What a project file names the part by: `definitionId` for standard and advanced components.
  // ICs have no id in the file (an entry carries the chip's name and pins), so it's just a handle.
  id: string;
  name: string;
  // "Passives › Resistors"
  category: string;
  keywords?: readonly string[];
  // Letters of its reference designator: "R" makes R1, R2...
  refPrefix: string;
}

export interface StandardCatalogPart extends CatalogPartBase {
  kind: "standard-component";
  // The unit `value` is in ("10k" for a resistor means 10 kΩ); absent for parts without a value.
  valueUnit?: string;
  // Which lead is which on a polarized part: [the `from` lead, the `to` lead].
  leadLabels?: readonly [string, string];
  led: boolean;
}

export interface CatalogPin {
  pin: number;
  label?: string;
  // Grid offset from the anchor (pin 1) at rotation 0: dx columns right, dy rows down.
  dx: number;
  dy: number;
}

export interface AdvancedCatalogPart extends CatalogPartBase {
  kind: "advanced-component";
  valueUnit?: string;
  // The user picks the block's rows and cols (header pins): pins form a rows x cols lattice whose
  // top-left pin is the anchor, numbered row by row.
  sizable: boolean;
  pins: CatalogPin[];
  // Holes under the body that aren't pins: nothing else can go in them.
  coveredHoles: {dx: number; dy: number}[];
}

export interface IcCatalogPart extends CatalogPartBase {
  kind: "ic";
  module: boolean;
  // As a placedIcs entry wants them at rotation 0: holes across, rows included, and pins per row.
  widthPin: number;
  heightPin: number;
  pinDescription: Record<number, string>;
}

export type CatalogPart = StandardCatalogPart | AdvancedCatalogPart | IcCatalogPart;

function categoryName(id: CategoryId): string {
  return getCategoryPath(id).map(category => category.name).join(" › ");
}

function standardPart(def: ComponentDefinition): StandardCatalogPart {
  return {
    kind: "standard-component", id: def.id, name: def.name, category: categoryName(def.category),
    ...(def.keywords ? {keywords: def.keywords} : {}), refPrefix: def.refPrefix,
    ...(def.unit ? {valueUnit: def.unit} : {}), ...(def.leadLabels ? {leadLabels: def.leadLabels} : {}),
    led: def.led === true,
  };
}

const round = (n: number) => Math.round(n * 1000) / 1000;
const offset = ({dx, dy}: PinOffset) => ({dx: round(dx), dy: round(dy)});

function advancedPart(def: AdvancedComponentDefinition): AdvancedCatalogPart {
  return {
    kind: "advanced-component", id: def.id, name: def.name, category: categoryName(def.category),
    ...(def.keywords ? {keywords: def.keywords} : {}), refPrefix: def.refPrefix,
    ...(def.unit ? {valueUnit: def.unit} : {}),
    sizable: def.gridSizable === true,
    pins: def.pinOffsets.map((o, i) => ({pin: i + 1, ...(def.pinLabels?.[i] ? {label: def.pinLabels[i]} : {}), ...offset(o)})),
    coveredHoles: (def.shadedOffsets ?? []).map(offset),
  };
}

function icPart(def: IcDefinition): IcCatalogPart {
  return {
    kind: "ic", id: def.id, name: def.name, category: categoryName(def.category),
    ...(def.keywords ? {keywords: def.keywords} : {}), refPrefix: "U",
    module: isModuleCategory(def.category),
    widthPin: def.widthPin, heightPin: def.heightPin, pinDescription: def.pinDescription,
  };
}

export const CATALOG: readonly CatalogPart[] = [
  ...COMPONENT_DEFINITIONS.map(standardPart),
  ...ADVANCED_COMPONENT_DEFINITIONS.map(advancedPart),
  ...IC_DEFINITIONS.map(icPart),
];

export function findPart(id: string): CatalogPart | undefined {
  const wanted = id.trim().toLowerCase();
  return CATALOG.find(part => part.id.toLowerCase() === wanted)
    ?? CATALOG.find(part => part.kind === "ic" && part.name.toLowerCase() === wanted);
}

// Ids that look like `id`, best first, for "did you mean" hints.
export function similarPartIds(id: string, limit = 3): string[] {
  const words = id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const score = (part: CatalogPart) => {
    const haystack = [part.id, part.name, ...(part.keywords ?? [])].join(" ").toLowerCase();
    return words.filter(word => haystack.includes(word)).length;
  };
  return CATALOG.map(part => ({id: part.id, score: score(part)}))
    .filter(({score}) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({id}) => id);
}

export function searchParts(query?: string, kind?: PartKind): CatalogPart[] {
  const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return CATALOG.filter(part => {
    if (kind && part.kind !== kind) return false;
    const haystack = [part.id, part.name, part.category, ...(part.keywords ?? [])].join(" ").toLowerCase();
    return words.every(word => haystack.includes(word));
  });
}

// One line per part, for listings: enough to choose, with get_part for the rest.
export function summarize(part: CatalogPart) {
  const pins = part.kind === "standard-component" ? "2 leads"
    : part.kind === "ic" ? `${part.heightPin * 2} pins`
    : part.sizable ? "rows x cols pins" : `${part.pins.length} pins`;
  return {kind: part.kind, id: part.id, name: part.name, category: part.category, pins};
}

// A project file entry for the part, placed with its anchor at `at`, to copy and adjust.
export function exampleEntry(part: CatalogPart, at: [number, number] = [1, 1], ref = `${part.refPrefix}1`) {
  switch (part.kind) {
    case "standard-component":
      return {
        list: "placedStandardComponents",
        entry: {
          ref, definitionId: part.id, from: at, to: [at[0] + 3, at[1]],
          ...(part.valueUnit ? {value: part.valueUnit === "Ω" ? "10k" : part.valueUnit === "F" ? "100n" : "10u"} : {}),
          ...(part.led ? {color: "#ef4444"} : {}),
        },
      };
    case "advanced-component":
      return {
        list: "placedAdvancedComponents",
        entry: {ref, definitionId: part.id, at, rotation: 0, rows: 1, cols: part.sizable ? 4 : 1},
      };
    case "ic":
      return {
        list: "placedIcs",
        entry: {
          ref, name: part.name, at, rotation: 0, widthPin: part.widthPin, heightPin: part.heightPin,
          pinDescription: part.pinDescription, category: (IC_DEFINITIONS.find(def => def.id === part.id)?.category ?? "ics"),
        },
      };
  }
}

// How to place a part, in words, for get_part.
export function placementNotes(part: CatalogPart): string {
  switch (part.kind) {
    case "standard-component":
      return [
        "A two-lead part: put it in placedStandardComponents with `from` and `to`, the two holes its leads go through (any two different holes; usually in line, 3 or more apart for a resistor or diode laid flat, 1-2 apart for a capacitor or LED standing up).",
        part.leadLabels ? `Polarized: the \`from\` lead is ${part.leadLabels[0]} and the \`to\` lead is ${part.leadLabels[1]}.` : "The leads are interchangeable.",
        part.valueUnit ? `\`value\` is in ${part.valueUnit} with SI prefixes, e.g. "4.7k", "100n", "10u".` : "",
        part.led ? "`color` (\"#rrggbb\") is the LED's color." : "",
      ].filter(Boolean).join(" ");
    case "advanced-component":
      return part.sizable
        ? "A block of pins: put it in placedAdvancedComponents with `at` as its top-left pin and `rows`/`cols` as its size (keep rotation 0; for a vertical strip use rows > 1, cols = 1). Pins are numbered row by row from the top-left."
        : [
          "A fixed-footprint part: put it in placedAdvancedComponents with `at` as pin 1's hole and `rotation` 0, 90, 180 or 270 (clockwise, turning about pin 1); rows and cols stay 1.",
          "Its other pins are at the `pins` offsets from pin 1 at rotation 0; at 90 an offset (dx, dy) becomes (-dy, dx), at 180 (-dx, -dy), at 270 (dy, -dx).",
          part.coveredHoles.length ? "`coveredHoles` are holes under its body that nothing else can use." : "",
          part.valueUnit ? `\`value\` is optional, in ${part.valueUnit}.` : "",
        ].filter(Boolean).join(" ");
    case "ic":
      return [
        "A dual-row chip or module: put it in placedIcs with `at` as its top-left pin, copying name, widthPin, heightPin and pinDescription from here.",
        `At rotation 0 its pins are two columns, ${part.widthPin - 1} apart: pins 1-${part.heightPin} run down the left column and ${part.heightPin + 1}-${part.heightPin * 2} back up the right one.`,
        "Rotated 90 or 270, swap widthPin and heightPin in the entry (they describe the part as placed); `at` stays its top-left pin. Use get_pin_positions to see where each pin lands.",
        "The holes between the two pin rows are under the body and can't be used.",
      ].join(" ");
  }
}
