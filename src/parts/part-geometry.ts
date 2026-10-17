import {AdvancedComponentDefinition, PIN_TILE_HALF, PinOffset} from "./advanced-component-definitions";
import {Rotation, rotateOffset} from "./rotate-offset";

// Where a placed part's pins and body are, worked out once from its placement, in grid units:
// x = column, y = row, from the top-left hole, with fractions for outlines that don't sit on holes.
// Everything that needs to know uses this one copy: the nets and the MCP server (through
// src/project-file/pin-positions.ts), the board renderer and the editor's hit tests (through
// src/board-render/artists/advanced-geometry.ts, in drawing px) and the 3D viewer.

export interface GridPoint {
  x: number;
  y: number;
}

// Edges included.
export interface GridBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// How far a part's body reaches past its outermost pins (and covered holes) when it has no
// outline of its own: 16px at the 50px pitch.
export const BODY_PAD = 0.32;

export function boxAround(points: GridPoint[], pad: number): GridBox {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {left: Math.min(...xs) - pad, top: Math.min(...ys) - pad, right: Math.max(...xs) + pad, bottom: Math.max(...ys) + pad};
}

// A fixed-pin (advanced) part, as a project file places it.
export interface AdvancedPlacement {
  // The anchor pin (the definition's first pin), or a grid-sizable block's top-left pin.
  at: readonly [number, number];
  rotation: Rotation;
  // Only used by grid-sizable parts (header pins): the size of the block the user spanned.
  rows: number;
  cols: number;
}

export interface AdvancedShape {
  // In the definition's pin order (pin 1 first).
  pins: GridPoint[];
  // Holes the body covers that aren't pins (e.g. a pot's skipped holes).
  covered: GridPoint[];
  // The body's outline polygon; empty when the body is just the padded box around the pins.
  outline: GridPoint[];
  // Where the part's artwork is centred.
  iconAnchor: GridPoint;
  // The body's box: the outline's, else the pins' and covered holes' padded by BODY_PAD.
  body: GridBox;
}

// A fixed-pin part's pins relative to its anchor, before rotation: the definition's, or for a
// grid-sizable part (header pins) the rows × cols block, row by row.
export function advancedPinOffsets(def: AdvancedComponentDefinition, rows: number, cols: number): PinOffset[] {
  if (!def.gridSizable) return def.pinOffsets;
  const offsets: PinOffset[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) offsets.push({dx: col, dy: row});
  }
  return offsets;
}

export function advancedPartShape(def: AdvancedComponentDefinition, part: AdvancedPlacement): AdvancedShape {
  const place = (offsets: PinOffset[]): GridPoint[] => offsets.map(({dx, dy}) => {
    const r = rotateOffset(dx, dy, part.rotation);
    return {x: part.at[0] + r.x, y: part.at[1] + r.y};
  });

  const pins = place(advancedPinOffsets(def, part.rows, part.cols));
  const covered = place(def.shadedOffsets ?? []);

  let outline: GridPoint[] = [];
  if (def.gridSizable) {
    // The block's footprint is its pin lattice grown by half a tile on every side, so the
    // outline traces the outer edge of the drawn tiles rather than their pin centers.
    const left = -PIN_TILE_HALF, top = -PIN_TILE_HALF;
    const right = part.cols - 1 + PIN_TILE_HALF, bottom = part.rows - 1 + PIN_TILE_HALF;
    outline = place([{dx: left, dy: top}, {dx: right, dy: top}, {dx: right, dy: bottom}, {dx: left, dy: bottom}]);
  } else if (def.bodyOutline) {
    outline = place(def.bodyOutline);
  }

  let iconAnchor: GridPoint;
  if (def.iconOffset) {
    iconAnchor = place([def.iconOffset])[0];
  } else {
    const box = boxAround(pins, 0);
    iconAnchor = {x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2};
  }

  const body = outline.length >= 3 ? boxAround(outline, 0) : boxAround([...pins, ...covered], BODY_PAD);
  return {pins, covered, outline, iconAnchor, body};
}

// A dual-row part (DIP chip or dev board), as a project file places it: its top-left pin and its
// footprint in holes, already swapped for 90°/270°.
export interface IcPlacement {
  at: readonly [number, number];
  widthPin: number;
  heightPin: number;
  rotation: Rotation;
}

// Which row of the chip a pin is in, as seen on the board.
export type IcSide = "left" | "right" | "top" | "bottom";

// A chip's pins, sorted by number, in DIP order: pin 1 top-left at rotation 0, then down that
// row and back up the other (counter-clockwise seen from above). The rotation turns the whole
// chip, so pin 1 follows the notch.
export function icPins(ic: IcPlacement): {pin: number; at: [number, number]; side: IcSide}[] {
  const [left, top] = ic.at;
  const pins: {pin: number; at: [number, number]; side: IcSide}[] = [];
  if (ic.rotation === 0 || ic.rotation === 180) {
    const perSide = ic.heightPin;
    const right = left + ic.widthPin - 1;
    for (let i = 0; i < perSide; i++) {
      pins.push({pin: ic.rotation === 0 ? i + 1 : perSide * 2 - i, at: [left, top + i], side: "left"});
      pins.push({pin: ic.rotation === 0 ? perSide * 2 - i : i + 1, at: [right, top + i], side: "right"});
    }
  } else {
    const perSide = ic.widthPin;
    const bottom = top + ic.heightPin - 1;
    for (let i = 0; i < perSide; i++) {
      pins.push({pin: ic.rotation === 90 ? i + 1 : perSide * 2 - i, at: [left + i, top], side: "top"});
      pins.push({pin: ic.rotation === 90 ? perSide * 2 - i : i + 1, at: [left + i, bottom], side: "bottom"});
    }
  }
  return pins.sort((a, b) => a.pin - b.pin);
}
