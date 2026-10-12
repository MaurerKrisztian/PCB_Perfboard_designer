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
import {drawComponentValueLabels} from "./component-value-labels";
import {behaviorOf} from "./tools";
import {DEFAULT_DOT_COLOR, drawMarkedPad, drawPad, PAD_RADIUS} from "./board-appearance";
import {GridConfig} from "../state/GridConfig";

// How strongly a hole shows through an IC body sitting on top of it.
const COVERED_PAD_OPACITY = 0.1;

const holeKey = (x: number, y: number) => `${x},${y}`;

// Holes under an IC's body, but not its pins. IC bodies are drawn before the dots, so without this
// the holes would be painted on top of the chip as if it were see-through.
function holesUnderIcBodies(): Set<string> {
  const covered = new Set<string>();
  const step = GridConfig.dotSpace;
  for (const ic of PartState.parts) {
    if (ic.kind !== "ic" || !ic.topLeftDot) continue;
    const pins = new Set(ic.getRealPinPositions().map(p => holeKey(p.x, p.y)));
    const {x: left, y: top} = ic.topLeftDot;
    for (let x = left; x <= left + step * (ic.widthPin - 1); x += step) {
      for (let y = top; y <= top + step * (ic.heightPin - 1); y += step) {
        if (!pins.has(holeKey(x, y))) covered.add(holeKey(x, y));
      }
    }
  }
  return covered;
}

function drawDot(dot: IDot, underIc = false){
  if (underIc) {
    Canvas.ctx.save();
    Canvas.ctx.globalAlpha = COVERED_PAD_OPACITY;
  }
  if (dot.color && dot.color.toLowerCase() !== DEFAULT_DOT_COLOR) {
    drawMarkedPad(dot.x, dot.y, dot.color);
  } else {
    drawPad(dot.x, dot.y);
  }
  if (underIc) Canvas.ctx.restore();

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

function drawLine(line: ILine){
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

  // Main trace line
  Canvas.ctx.beginPath();
  Canvas.ctx.moveTo(line.start.x, line.start.y);
  Canvas.ctx.lineTo(line.end.x, line.end.y);
  Canvas.ctx.strokeStyle = line.color || "#777676";
  Canvas.ctx.lineWidth = baseWidth;
  Canvas.ctx.lineCap = "round";
  Canvas.ctx.stroke();
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
    drawDot(dot, underIcs.has(holeKey(dot.x, dot.y)));
  }
  // 3. Draw wires
  for (let i = 0; i < LineState.lines.length; i++) {
    drawLine(LineState.lines[i]);
  }
  // 4. Draw standard, then advanced (fixed-pin) component bodies, above wires/dots
  for (const part of PartState.parts) {
    if (part.layer === "over-wires") part.draw(part === selected);
  }
  // 5. Draw silkscreen-style component value labels (when toggled on)
  drawComponentValueLabels();
  // 6. Draw IC text badges on top of everything
  PartState.parts.forEach((part: PlacedPart) => part.drawOverlay?.(part === selected));
  // 7. The active tool's placement preview
  const tool = ToolState.active;
  if (DotState.hoverDot) behaviorOf(tool).drawPreview?.(tool, DotState.hoverDot);
}
