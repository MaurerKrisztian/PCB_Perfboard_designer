import {GridPos} from "./grid";
import {ProjectFile, Rotation} from "./project-file";
import {getComponentDefinition} from "../features/standard-components/component-definitions";
import {getAdvancedComponentDefinition, PIN_TILE_HALF, PinOffset} from "../features/advanced-components/advanced-component-definitions";
import {rotateOffset} from "../features/advanced-components/rotate-offset";

// Where each placed part's pins land on the board, in grid [column, row] holes: the facts a
// project file leaves out because they follow from it. Shared by the MCP server and the nets
// (nets.ts). Mirrors the editor's placed-part classes (placed-advanced-component.ts, ic.ts), in
// grid units instead of pixels: change them together.

// Which project file list a part is in.
export type PartKind = "standard-component" | "advanced-component" | "ic";

export interface PlacedPin {
  pin: number;
  label?: string;
  at: GridPos;
}

// A part's box in grid units, edges included: the holes and the space it takes up.
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PartPins {
  ref: string;
  kind: PartKind;
  // definitionId, or a chip's name.
  part: string;
  known: boolean;
  pins: PlacedPin[];
  // Holes under the body that aren't pins (a chip's middle, a pot's skipped holes).
  coveredHoles: GridPos[];
  // Where the body sits, for overlap checks. Absent for two-lead parts, whose body hangs between
  // their leads and can sit next to anything.
  body?: Box;
}

// How far a part's body reaches past its outermost pins when it has no outline of its own.
const BODY_PAD = 0.3;

function boxAround(points: {x: number; y: number}[], pad: number): Box {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {left: Math.min(...xs) - pad, top: Math.min(...ys) - pad, right: Math.max(...xs) + pad, bottom: Math.max(...ys) + pad};
}

function placeOffsets(at: GridPos, offsets: PinOffset[], rotation: Rotation): {x: number; y: number}[] {
  return offsets.map(({dx, dy}) => {
    const r = rotateOffset(dx, dy, rotation);
    return {x: at[0] + r.x, y: at[1] + r.y};
  });
}

const hole = (p: {x: number; y: number}): GridPos => [Math.round(p.x), Math.round(p.y)];

// The pins of a placedIcs entry, numbered as the editor's Ic.getRealPinPositions does: DIP order,
// pin 1 top-left at rotation 0, counter-clockwise from there.
export function icPins(ic: {at: GridPos; widthPin: number; heightPin: number; rotation: Rotation}): {pin: number; at: GridPos}[] {
  const [left, top] = ic.at;
  const pins: {pin: number; at: GridPos}[] = [];
  if (ic.rotation === 0 || ic.rotation === 180) {
    const perSide = ic.heightPin;
    const right = left + ic.widthPin - 1;
    for (let i = 0; i < perSide; i++) {
      pins.push({pin: ic.rotation === 0 ? i + 1 : perSide * 2 - i, at: [left, top + i]});
      pins.push({pin: ic.rotation === 0 ? perSide * 2 - i : i + 1, at: [right, top + i]});
    }
  } else {
    const perSide = ic.widthPin;
    const bottom = top + ic.heightPin - 1;
    for (let i = 0; i < perSide; i++) {
      pins.push({pin: ic.rotation === 90 ? i + 1 : perSide * 2 - i, at: [left + i, top]});
      pins.push({pin: ic.rotation === 90 ? perSide * 2 - i : i + 1, at: [left + i, bottom]});
    }
  }
  return pins.sort((a, b) => a.pin - b.pin);
}

export function partPins(project: ProjectFile): PartPins[] {
  const parts: PartPins[] = [];

  for (const ic of project.placedIcs) {
    const pins = icPins(ic).map(({pin, at}) => ({pin, ...(ic.pinDescription[pin] ? {label: ic.pinDescription[pin]} : {}), at}));
    const isPin = new Set(pins.map(p => `${p.at[0]},${p.at[1]}`));
    const coveredHoles: GridPos[] = [];
    for (let col = ic.at[0]; col < ic.at[0] + ic.widthPin; col++) {
      for (let row = ic.at[1]; row < ic.at[1] + ic.heightPin; row++) {
        if (!isPin.has(`${col},${row}`)) coveredHoles.push([col, row]);
      }
    }
    parts.push({
      ref: ic.ref, kind: "ic", part: ic.name, known: true, pins, coveredHoles,
      body: boxAround(pins.map(p => ({x: p.at[0], y: p.at[1]})), BODY_PAD),
    });
  }

  for (const part of project.placedStandardComponents) {
    const def = getComponentDefinition(part.definitionId);
    const lead = (pin: 1 | 2, at: GridPos): PlacedPin => ({pin, ...(def?.leadLabels ? {label: def.leadLabels[pin - 1]} : {}), at});
    parts.push({
      ref: part.ref, kind: "standard-component", part: part.definitionId, known: !!def,
      pins: [lead(1, part.from), lead(2, part.to)], coveredHoles: [],
    });
  }

  for (const part of project.placedAdvancedComponents) {
    const def = getAdvancedComponentDefinition(part.definitionId);
    if (!def) {
      parts.push({ref: part.ref, kind: "advanced-component", part: part.definitionId, known: false, pins: [{pin: 1, at: part.at}], coveredHoles: []});
      continue;
    }
    let offsets = def.pinOffsets;
    if (def.gridSizable) {
      offsets = [];
      for (let row = 0; row < part.rows; row++) {
        for (let col = 0; col < part.cols; col++) offsets.push({dx: col, dy: row});
      }
    }
    const pinPoints = placeOffsets(part.at, offsets, part.rotation);
    const shaded = placeOffsets(part.at, def.shadedOffsets ?? [], part.rotation);
    const body = def.gridSizable
      ? boxAround(pinPoints, PIN_TILE_HALF)
      : def.bodyOutline ? boxAround(placeOffsets(part.at, def.bodyOutline, part.rotation), 0) : boxAround([...pinPoints, ...shaded], BODY_PAD);
    parts.push({
      ref: part.ref, kind: "advanced-component", part: part.definitionId, known: true,
      pins: pinPoints.map((p, i) => ({pin: i + 1, ...(!def.gridSizable && def.pinLabels?.[i] ? {label: def.pinLabels[i]} : {}), at: hole(p)})),
      coveredHoles: shaded.map(hole),
      body,
    });
  }

  return parts;
}
