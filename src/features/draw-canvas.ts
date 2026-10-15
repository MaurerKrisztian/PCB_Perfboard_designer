import {resetCanvas} from "./reset-canvas";
import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {PartState} from "../state/PartState";
import {PlacedPart} from "../interfaces/placed-part.interface";
import {Canvas} from "../state/Canvas";
import {IDot} from "../interfaces/dot.interface";
import {ILine} from "../interfaces/line.interface";
import {ToolState} from "../state/ToolState";
import {SelectionState} from "../state/SelectionState";
import {drawPartLabels} from "./part-labels";
import {behaviorOf} from "./tools";
import {activeBoardLook} from "./board-looks";
import {PAD_RADIUS} from "./board-looks/board-look";
import {GridConfig} from "../state/GridConfig";
import {NetHighlightState} from "../state/NetHighlightState";
import {GridPos, gridToPx, toGridPos} from "../project-file/grid";
import {layoutWires, WireHop, WireLayout} from "../project-file/wire-crossings";

// How strongly a hole shows through a chip or board sitting on top of it: not at all.
const COVERED_PAD_OPACITY = 0;

const holeKey = (x: number, y: number) => `${x},${y}`;

// Holes under an IC's body, but not its pins, with how strongly each one shows. IC bodies are
// drawn before the dots, so without this the holes would be painted on top of the chip as if it
// were see-through.
function holesUnderIcBodies(): Map<string, number> {
  const covered = new Map<string, number>();
  const step = GridConfig.dotSpace;
  for (const ic of PartState.parts) {
    if (ic.kind !== "ic" || !ic.topLeftDot) continue;
    const pins = new Set(ic.getRealPinPositions().map(p => holeKey(p.x, p.y)));
    const {x: left, y: top} = ic.topLeftDot;
    for (let x = left; x <= left + step * (ic.widthPin - 1); x += step) {
      for (let y = top; y <= top + step * (ic.heightPin - 1); y += step) {
        if (!pins.has(holeKey(x, y))) covered.set(holeKey(x, y), COVERED_PAD_OPACITY);
      }
    }
  }
  return covered;
}

// `opacity` is how strongly the hole shows through a chip on top of it (1 when uncovered).
function drawDot(dot: IDot, opacity = 1){
  if (opacity > 0) {
    Canvas.ctx.save();
    Canvas.ctx.globalAlpha = opacity;
    activeBoardLook().drawHole(dot);
    Canvas.ctx.restore();
  }

  if (dot === SelectionState.dot) {
    // Outer glowing selection ring
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, PAD_RADIUS + 4, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#38bdf8";
    Canvas.ctx.lineWidth = 3;
    Canvas.ctx.stroke();

    // Inner ring marker
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, PAD_RADIUS + 1, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#ffffff";
    Canvas.ctx.lineWidth = 1.5;
    Canvas.ctx.stroke();
  } else if (dot === ToolState.pendingStart) {
    // Pending placement start pad highlight
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, PAD_RADIUS + 4, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#22c55e";
    Canvas.ctx.lineWidth = 3;
    Canvas.ctx.stroke();
  } else if (dot === DotState.hoverDot) {
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, PAD_RADIUS + 3, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#e2e8f0";
    Canvas.ctx.lineWidth = 2;
    Canvas.ctx.stroke();
  }



  if (dot.description) {
    Canvas.ctx.font = "10px Inter, Arial";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.fillStyle = dot.color || "#38bdf8";
    if (dot === DotState.hoverDot) {
      Canvas.ctx.fillText(dot.description, dot.x, dot.y + PAD_RADIUS + 11);
    } else {
      Canvas.ctx.fillText(dot.description.substring(0, 5), dot.x, dot.y + PAD_RADIUS + 11);
    }
  }
}

// Where a wire goes over something it doesn't join (another wire, or a hole holding a pin, a lead
// or a wire's end): a dark edge either side of it there, cutting whatever is underneath, so it
// reads as passing over. Where three or more things do join: a solder dot, like a schematic's
// junction dot. See wire-crossings.ts.
const OVER_EDGE_COLOR = "#0b1120";
const JUNCTION_FILL = "#d1d5db";
const JUNCTION_EDGE = "#374151";
const JUNCTION_RADIUS = 6;

// Worked out from the board as it is right now, so the edges follow a wire being dragged.
function liveWireLayout(): WireLayout {
  const pinHoles = PartState.parts.flatMap(part => part.getPinPositions().map(toGridPos));
  return layoutWires(LineState.lines.map(line => ({from: toGridPos(line.start), to: toGridPos(line.end)})), pinHoles);
}

function drawOverEdges(line: ILine, hops: WireHop[]) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return;
  const ux = dx / length, uy = dy / length;
  const ctx = Canvas.ctx;
  ctx.save();
  ctx.strokeStyle = OVER_EDGE_COLOR;
  ctx.lineWidth = (line.width || 4) + 6;
  ctx.lineCap = "butt";
  for (const hop of hops) {
    // Long enough to cut across what's underneath: the other wire, or the hole's pad.
    const under = hop.under !== undefined ? LineState.lines[hop.under] : undefined;
    const half = under ? (under.width || 4) / 2 + 5 : PAD_RADIUS + 2;
    const x = gridToPx(hop.at[0]), y = gridToPx(hop.at[1]);
    ctx.beginPath();
    ctx.moveTo(x - ux * half, y - uy * half);
    ctx.lineTo(x + ux * half, y + uy * half);
    ctx.stroke();
  }
  ctx.restore();
}

function drawJunctions(junctions: GridPos[]) {
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

function drawLine(line: ILine, hops: WireHop[] = []){
  const baseWidth = line.width || 4;

  // Selected line glowing highlight & terminal node handles
  if (line === SelectionState.line) {
    // Outer selection glow aura
    Canvas.ctx.beginPath();
    Canvas.ctx.moveTo(line.start.x, line.start.y);
    Canvas.ctx.lineTo(line.end.x, line.end.y);
    Canvas.ctx.strokeStyle = "#38bdf8";
    Canvas.ctx.lineWidth = baseWidth + 6;
    Canvas.ctx.lineCap = "round";
    Canvas.ctx.stroke();

    // Terminal node end rings
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(line.start.x, line.start.y, baseWidth + 3, 0, Math.PI * 2);
    Canvas.ctx.arc(line.end.x, line.end.y, baseWidth + 3, 0, Math.PI * 2);
    Canvas.ctx.fillStyle = "#38bdf8";
    Canvas.ctx.fill();
  } else if (line === LineState.hoverLine) {
    Canvas.ctx.beginPath();
    Canvas.ctx.moveTo(line.start.x, line.start.y);
    Canvas.ctx.lineTo(line.end.x, line.end.y);
    Canvas.ctx.strokeStyle = "#94a3b8";
    Canvas.ctx.lineWidth = baseWidth + 3;
    Canvas.ctx.lineCap = "round";
    Canvas.ctx.stroke();
  }

  drawOverEdges(line, hops);

  // Main trace line
  Canvas.ctx.beginPath();
  Canvas.ctx.moveTo(line.start.x, line.start.y);
  Canvas.ctx.lineTo(line.end.x, line.end.y);
  Canvas.ctx.strokeStyle = line.color || "#777676";
  Canvas.ctx.lineWidth = baseWidth;
  Canvas.ctx.lineCap = "round";
  Canvas.ctx.stroke();
}

// Same as --net-highlight in style.css, which marks the picked net in the panel.
const NET_HIGHLIGHT_COLOR = "#e879f9";

// The net picked in the Nets panel: a glow along its wires and a ring on every hole, drawn over
// everything so it shows through parts sitting on it.
function drawNetHighlight() {
  const net = NetHighlightState.current;
  if (!net) return;
  const ctx = Canvas.ctx;
  ctx.save();
  ctx.strokeStyle = NET_HIGHLIGHT_COLOR;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.55;
  for (const wire of net.wires) {
    ctx.beginPath();
    ctx.moveTo(gridToPx(wire.from[0]), gridToPx(wire.from[1]));
    ctx.lineTo(gridToPx(wire.to[0]), gridToPx(wire.to[1]));
    ctx.lineWidth = (wire.width || 4) + 8;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 3;
  for (const [col, row] of net.holes) {
    ctx.beginPath();
    ctx.arc(gridToPx(col), gridToPx(row), PAD_RADIUS + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// Run after every redraw. Every change to the board ends in one, so this is how a feature hears
// about changes without each edit having to report itself (autosave uses it).
const redrawListeners: (() => void)[] = [];

export function onRedraw(listener: () => void) {
  redrawListeners.push(listener);
}

export function redrawCanvas() {
  resetCanvas();
  const selected = SelectionState.part;
  // 1. Draw IC chip bodies
  for (const part of PartState.parts) {
    if (part.layer === "under-board") part.draw(part === selected);
  }
  // 2. Draw grid dots (faded where an IC body covers them)
  const underIcs = holesUnderIcBodies();
  for (let i = 0; i < DotState.dots.length; i++) {
    const dot = DotState.dots[i];
    drawDot(dot, underIcs.get(holeKey(dot.x, dot.y)));
  }
  // 3. Draw wires, each with dark edges where it goes over something it doesn't join
  const wireLayout = liveWireLayout();
  const hopsByWire = new Map<number, WireHop[]>();
  for (const hop of wireLayout.hops) hopsByWire.set(hop.wire, [...(hopsByWire.get(hop.wire) ?? []), hop]);
  for (let i = 0; i < LineState.lines.length; i++) {
    drawLine(LineState.lines[i], hopsByWire.get(i));
  }
  // 4. Draw standard, then advanced (fixed-pin) component bodies, above wires/dots
  for (const part of PartState.parts) {
    if (part.layer === "over-wires") part.draw(part === selected);
  }
  // 5. Junction dots, over component leads too, where three or more things are joined
  drawJunctions(wireLayout.junctions);
  // 6. Draw silkscreen-style part labels, ref and value (when toggled on)
  drawPartLabels();
  // 7. Draw IC text badges on top of everything
  PartState.parts.forEach((part: PlacedPart) => part.drawOverlay?.(part === selected));
  // 8. The net picked in the Nets panel
  drawNetHighlight();
  // 9. The active tool's placement preview
  const tool = ToolState.active;
  if (DotState.hoverDot) behaviorOf(tool).drawPreview?.(tool, DotState.hoverDot);

  for (const listener of redrawListeners) listener();
}
