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
import {WireHop} from "../project-file/wire-crossings";
import {drawJunctions, drawOverEdges, liveWireMarks} from "./wire-crossing-marks";
import {drawNetHighlight} from "./net-highlight";

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
  const wireMarks = liveWireMarks();
  for (let i = 0; i < LineState.lines.length; i++) {
    drawLine(LineState.lines[i], wireMarks.hopsByWire.get(i));
  }
  // 4. Draw standard, then advanced (fixed-pin) component bodies, above wires/dots
  for (const part of PartState.parts) {
    if (part.layer === "over-wires") part.draw(part === selected);
  }
  // 5. Junction dots, over component leads too, where three or more things are joined
  drawJunctions(wireMarks.junctions);
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
