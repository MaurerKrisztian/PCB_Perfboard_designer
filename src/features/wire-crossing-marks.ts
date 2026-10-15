import {Canvas} from "../state/Canvas";
import {LineState} from "../state/LineState";
import {PartState} from "../state/PartState";
import {ILine} from "../interfaces/line.interface";
import {PAD_RADIUS} from "./board-looks/board-look";
import {GridPos, gridToPx, toGridPos} from "../project-file/grid";
import {layoutWires, WireHop} from "../project-file/wire-crossings";

// How the canvas shows wire crossings (see wire-crossings.ts). Where a wire goes over something it
// doesn't join (another wire, or a hole holding a pin, a lead or a wire's end): a dark edge either
// side of it there, cutting whatever is underneath, so it reads as passing over. Where three or
// more things do join: a solder dot, like a schematic's junction dot.

const OVER_EDGE_COLOR = "#0b1120";
const JUNCTION_FILL = "#d1d5db";
const JUNCTION_EDGE = "#374151";
const JUNCTION_RADIUS = 6;
const DEFAULT_WIRE_WIDTH = 4;

export interface LiveWireMarks {
  // Each wire's hops, by its index in LineState.lines.
  hopsByWire: Map<number, WireHop[]>;
  junctions: GridPos[];
}

// Worked out from the board as it is right now, so the marks follow a wire being dragged.
export function liveWireMarks(): LiveWireMarks {
  const pinHoles = PartState.parts.flatMap(part => part.getPinPositions().map(toGridPos));
  const wires = LineState.lines.map(line => ({from: toGridPos(line.start), to: toGridPos(line.end)}));
  const {hops, junctions} = layoutWires(wires, pinHoles);
  const hopsByWire = new Map<number, WireHop[]>();
  for (const hop of hops) hopsByWire.set(hop.wire, [...(hopsByWire.get(hop.wire) ?? []), hop]);
  return {hopsByWire, junctions};
}

// Drawn just under the wire itself, so the wire runs between its two edges.
export function drawOverEdges(line: ILine, hops: WireHop[]) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const ux = dx / length, uy = dy / length;
  const ctx = Canvas.ctx;
  ctx.save();
  ctx.strokeStyle = OVER_EDGE_COLOR;
  ctx.lineWidth = (line.width || DEFAULT_WIRE_WIDTH) + 6;
  ctx.lineCap = "butt";
  for (const hop of hops) {
    // Long enough to cut across what's underneath: the other wire, or the hole's pad.
    const under = hop.under !== undefined ? LineState.lines[hop.under] : undefined;
    const half = under ? (under.width || DEFAULT_WIRE_WIDTH) / 2 + 5 : PAD_RADIUS + 2;
    const x = gridToPx(hop.at[0]), y = gridToPx(hop.at[1]);
    ctx.beginPath();
    ctx.moveTo(x - ux * half, y - uy * half);
    ctx.lineTo(x + ux * half, y + uy * half);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawJunctions(junctions: GridPos[]) {
  const ctx = Canvas.ctx;
  ctx.lineWidth = 1.5;
  ctx.fillStyle = JUNCTION_FILL;
  ctx.strokeStyle = JUNCTION_EDGE;
  for (const [col, row] of junctions) {
    ctx.beginPath();
    ctx.arc(gridToPx(col), gridToPx(row), JUNCTION_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
