import {GridPos, gridToPx} from "../../project-file/grid";
import {SavedWire} from "../../project-file/project-file";
import {WireHop} from "../../project-file/wire-crossings";
import {BoardView, isHovered, isSameItem} from "../board-view";
import {Painter} from "../painter/painter";
import {DEFAULT_WIRE_COLOR, DEFAULT_WIRE_WIDTH, PAD_RADIUS, SELECTION_COLOR} from "../palette";

// Wires, and how crossings show (see src/project-file/wire-crossings.ts). Where a wire goes over
// something it doesn't join (another wire, or a hole holding a pin, a lead or a wire's end): a dark
// edge either side of it there, cutting whatever is underneath, so it reads as passing over. Where
// three or more things do join: a solder dot, like a schematic's junction dot.

const HOVER_COLOR = "#94a3b8";
const OVER_EDGE_COLOR = "#0b1120";
const JUNCTION_FILL = "#d1d5db";
const JUNCTION_EDGE = "#374151";
const JUNCTION_RADIUS = 6;

const widthOf = (wire: SavedWire) => wire.width || DEFAULT_WIRE_WIDTH;

// In list order, so a later wire is drawn over an earlier one, as wire-crossings.ts assumes.
export function drawWires(painter: Painter, wires: SavedWire[], hops: WireHop[], view: BoardView) {
  const hopsByWire = new Map<number, WireHop[]>();
  for (const hop of hops) hopsByWire.set(hop.wire, [...(hopsByWire.get(hop.wire) ?? []), hop]);

  wires.forEach((wire, index) => {
    const ends = [{x: gridToPx(wire.from[0]), y: gridToPx(wire.from[1])}, {x: gridToPx(wire.to[0]), y: gridToPx(wire.to[1])}];
    const width = widthOf(wire);
    const item = {kind: "wire", index} as const;
    if (isSameItem(view.selected, item)) {
      // A glow along it, and a handle on each end.
      painter.line(ends, {paint: SELECTION_COLOR, width: width + 6, cap: "round"});
      for (const end of ends) painter.circle(end.x, end.y, width + 3, {fill: SELECTION_COLOR});
    } else if (isHovered(view, item)) {
      painter.line(ends, {paint: HOVER_COLOR, width: width + 3, cap: "round"});
    }
    drawOverEdges(painter, wire, wires, hopsByWire.get(index) ?? []);
    painter.line(ends, {paint: wire.color || DEFAULT_WIRE_COLOR, width, cap: "round"});
  });
}

// Drawn just under the wire itself, so the wire runs between its two edges.
function drawOverEdges(painter: Painter, wire: SavedWire, wires: SavedWire[], hops: WireHop[]) {
  const dx = wire.to[0] - wire.from[0];
  const dy = wire.to[1] - wire.from[1];
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const ux = dx / length, uy = dy / length;
  for (const hop of hops) {
    // Long enough to cut across what's underneath: the other wire, or the hole's pad.
    const under = hop.under !== undefined ? wires[hop.under] : undefined;
    const half = under ? widthOf(under) / 2 + 5 : PAD_RADIUS + 2;
    const x = gridToPx(hop.at[0]), y = gridToPx(hop.at[1]);
    painter.line([{x: x - ux * half, y: y - uy * half}, {x: x + ux * half, y: y + uy * half}], {paint: OVER_EDGE_COLOR, width: widthOf(wire) + 6});
  }
}

export function drawJunctions(painter: Painter, junctions: GridPos[]) {
  for (const [col, row] of junctions) {
    painter.circle(gridToPx(col), gridToPx(row), JUNCTION_RADIUS, {fill: JUNCTION_FILL, stroke: {paint: JUNCTION_EDGE, width: 1.5}});
  }
}
