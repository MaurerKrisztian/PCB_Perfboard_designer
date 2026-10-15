// The 3D viewer's own, read-only view of a saved project file. It is deliberately decoupled
// from the editor's state classes: the file is read by the same pure reader the editor uses
// (src/project-file/), then laid out in pixels, so the viewer can render any project file on its own.

import {GRID_PITCH_PX, GridPos, gridToPx} from "../project-file/grid";
import {readProjectFile} from "../project-file/read-project-file";
import {StripDirection} from "../project-file/project-file";
import {layoutProjectWires} from "../project-file/wire-crossings";

export type Rotation = 0 | 90 | 180 | 270;

export interface ViewerDot {
  x: number;
  y: number;
  color?: string;
}

export type ViewerBoard =
  | {type: "perfboard"}
  | {type: "stripboard"; strips: StripDirection; cuts: {x: number; y: number}[]};

// Where a wire goes over something it doesn't join (see wire-crossings.ts), in pixels.
// `underWidth` is the width of the wire it crosses; absent over a hole holding a pin, a lead or
// another wire's end.
export interface ViewerHop {
  x: number;
  y: number;
  underWidth?: number;
}

export interface ViewerWire {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  // In order from (x1, y1).
  hops: ViewerHop[];
}

export interface ViewerIc {
  name: string;
  widthPin: number;
  heightPin: number;
  rotationAngle: Rotation;
  pinDescription: Record<number, string>;
  // Catalog category it was placed from; undefined in files that predate it.
  category?: string;
  left: number;
  top: number;
}

export interface ViewerStandardPart {
  definitionId: string;
  value?: string;
  color?: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface ViewerAdvancedPart {
  definitionId: string;
  value?: string;
  rotationAngle: Rotation;
  anchorX: number;
  anchorY: number;
  rows: number;
  cols: number;
}

export interface ViewerProject {
  canvasWidth: number;
  canvasHeight: number;
  board: ViewerBoard;
  dots: ViewerDot[];
  wires: ViewerWire[];
  ics: ViewerIc[];
  standardParts: ViewerStandardPart[];
  advancedParts: ViewerAdvancedPart[];
}

const DEFAULT_WIRE_COLOR = "#777676";
const DEFAULT_WIRE_WIDTH = 4;

const px = ([col, row]: GridPos) => ({x: gridToPx(col), y: gridToPx(row)});

/** Reads a project file (already JSON-decoded, any version) into the viewer's pixel-space model.
 *  Throws ProjectFileError on files that aren't perfboard projects at all; individual malformed
 *  entries are left out instead. */
export function readProject(raw: unknown): ViewerProject {
  const {project} = readProjectFile(raw);
  const {cols, rows} = project.board;
  const board: ViewerBoard = project.board.type === "stripboard"
    ? {type: "stripboard", strips: project.board.strips, cuts: project.board.cuts.map(px)}
    : {type: "perfboard"};

  const padColors = new Map(project.pads.filter(pad => pad.color).map(pad => [`${pad.at[0]},${pad.at[1]}`, pad.color]));
  const dots: ViewerDot[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      dots.push({...px([col, row]), color: padColors.get(`${col},${row}`)});
    }
  }

  const {hops} = layoutProjectWires(project);
  const wires: ViewerWire[] = project.wires.map((wire, i) => {
    const from = px(wire.from);
    const to = px(wire.to);
    return {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      color: wire.color ?? DEFAULT_WIRE_COLOR, width: wire.width ?? DEFAULT_WIRE_WIDTH,
      hops: hops.filter(hop => hop.wire === i).map(hop => ({
        ...px(hop.at),
        ...(hop.under !== undefined ? {underWidth: project.wires[hop.under].width ?? DEFAULT_WIRE_WIDTH} : {}),
      })),
    };
  });

  const ics: ViewerIc[] = project.placedIcs.map(ic => {
    const {x: left, y: top} = px(ic.at);
    return {
      name: ic.name,
      // The chip body needs two pin columns to have any width.
      widthPin: Math.max(2, ic.widthPin),
      heightPin: ic.heightPin,
      rotationAngle: ic.rotation,
      pinDescription: ic.pinDescription,
      category: ic.category,
      left, top,
    };
  });

  const standardParts: ViewerStandardPart[] = project.placedStandardComponents.map(part => {
    const start = px(part.from);
    const end = px(part.to);
    return {
      definitionId: part.definitionId, value: part.value, color: part.color,
      startX: start.x, startY: start.y, endX: end.x, endY: end.y,
    };
  });

  const advancedParts: ViewerAdvancedPart[] = project.placedAdvancedComponents.map(part => {
    const anchor = px(part.at);
    return {
      definitionId: part.definitionId, value: part.value, rotationAngle: part.rotation,
      anchorX: anchor.x, anchorY: anchor.y, rows: part.rows, cols: part.cols,
    };
  });

  return {
    canvasWidth: cols * GRID_PITCH_PX, canvasHeight: rows * GRID_PITCH_PX,
    board, dots, wires, ics, standardParts, advancedParts,
  };
}
