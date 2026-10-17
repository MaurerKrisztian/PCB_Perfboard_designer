import {GridPos} from "./grid";
import {ProjectFile} from "./project-file";
import {getComponentDefinition} from "../parts/component-definitions";
import {getAdvancedComponentDefinition} from "../parts/advanced-component-definitions";
import {advancedPartShape, BODY_PAD, boxAround, GridBox, GridPoint, icPins} from "../parts/part-geometry";
import {PartKind} from "./part-refs";

// Where each placed part's pins land on the board, in grid [column, row] holes: the facts a
// project file leaves out because they follow from it, for the nets (nets.ts) and for any program
// reading project files. The geometry itself is src/parts/part-geometry.ts, shared with the board
// renderer, the editor and the 3D viewer.

export interface PlacedPin {
  pin: number;
  label?: string;
  at: GridPos;
}

// A part's box in grid units, edges included: the holes and the space it takes up.
export type Box = GridBox;

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

const hole = (p: GridPoint): GridPos => [Math.round(p.x), Math.round(p.y)];

export function partPins(project: ProjectFile): PartPins[] {
  const parts: PartPins[] = [];

  for (const ic of project.placedIcs) {
    const pins: PlacedPin[] = icPins(ic).map(({pin, at}) => ({pin, ...(ic.pinDescription[pin] ? {label: ic.pinDescription[pin]} : {}), at}));
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
    const shape = advancedPartShape(def, part);
    parts.push({
      ref: part.ref, kind: "advanced-component", part: part.definitionId, known: true,
      pins: shape.pins.map((p, i) => ({pin: i + 1, ...(!def.gridSizable && def.pinLabels?.[i] ? {label: def.pinLabels[i]} : {}), at: hole(p)})),
      coveredHoles: shape.covered.map(hole),
      body: shape.body,
    });
  }

  return parts;
}
