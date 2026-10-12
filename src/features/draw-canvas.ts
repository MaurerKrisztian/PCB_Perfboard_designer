import {resetCanvas} from "./reset-canvas";
import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {IcState} from "../state/IcState";
import {PartState} from "../state/PartState";
import {PlacedPart} from "../interfaces/placed-part.interface";
import {Canvas} from "../state/Canvas";
import {IDot} from "../interfaces/dot.interface";
import {ILine} from "../interfaces/line.interface";
import {StandardComponentState} from "../state/StandardComponentState";
import {ToolState} from "../state/ToolState";
import {getComponentDefinition} from "./standard-components/component-definitions";
import {drawStandardComponentBody} from "./standard-components/standard-component-render";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {getAdvancedComponentDefinition} from "./advanced-components/advanced-component-definitions";
import {drawAdvancedComponentBody} from "./advanced-components/advanced-component-render";
import {PlacedAdvancedComponent} from "./advanced-components/placed-advanced-component";
import {drawComponentValueLabels} from "./component-value-labels";
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

  if (dot === DotState.selectedDot) {
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
  } else if (dot === ToolState.wireStartDot || dot === StandardComponentState.pendingStartDot
             || dot === AdvancedComponentState.pendingAnchorDot) {
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
  if (line === LineState.selectedLine) {
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

function drawIcPlacementPreview() {
  if (!IcState.selectedIc || !DotState.hoverDot) return;
  const targetDot = DotState.hoverDot;
  const w = 50 * (IcState.selectedIc.widthPin - 1);
  const h = 50 * (IcState.selectedIc.heightPin - 1);

  Canvas.ctx.save();
  Canvas.ctx.beginPath();
  Canvas.ctx.fillStyle = "rgba(6, 182, 212, 0.25)";
  Canvas.ctx.strokeStyle = "#38bdf8";
  Canvas.ctx.lineWidth = 2;
  Canvas.ctx.setLineDash([6, 4]);

  Canvas.ctx.rect(targetDot.x, targetDot.y, w, h);
  Canvas.ctx.stroke();
  Canvas.ctx.fill();

  // Placement preview label
  Canvas.ctx.setLineDash([]);
  Canvas.ctx.fillStyle = "#ffffff";
  Canvas.ctx.font = "bold 11px Inter, Arial";
  Canvas.ctx.textAlign = "center";
  Canvas.ctx.fillText(`➕ Place ${IcState.selectedIc.name}`, targetDot.x + (w / 2), targetDot.y + (h / 2) + 4);

  Canvas.ctx.restore();
}

function drawStandardComponentPlacementPreview() {
  if (!StandardComponentState.armedDefinitionId || !DotState.hoverDot) return;
  const def = getComponentDefinition(StandardComponentState.armedDefinitionId);
  if (!def) return;

  Canvas.ctx.save();

  if (!StandardComponentState.pendingStartDot) {
    // No start dot chosen yet - show a small marker + hint at the hover dot
    Canvas.ctx.beginPath();
    Canvas.ctx.setLineDash([4, 3]);
    Canvas.ctx.strokeStyle = "#38bdf8";
    Canvas.ctx.lineWidth = 2;
    Canvas.ctx.arc(DotState.hoverDot.x, DotState.hoverDot.y, 10, 0, Math.PI * 2);
    Canvas.ctx.stroke();

    Canvas.ctx.setLineDash([]);
    Canvas.ctx.fillStyle = "#ffffff";
    Canvas.ctx.font = "bold 11px Inter, Arial";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.fillText(`➕ Start ${def.name}`, DotState.hoverDot.x, DotState.hoverDot.y - 16);
  } else {
    drawStandardComponentBody(StandardComponentState.pendingStartDot, DotState.hoverDot, def, {ghost: true});
  }

  Canvas.ctx.restore();
}

function drawAdvancedComponentPlacementPreview() {
  if (!AdvancedComponentState.armedDefinitionId || !DotState.hoverDot) return;
  const def = getAdvancedComponentDefinition(AdvancedComponentState.armedDefinitionId);
  if (!def) return;

  let ghostAnchor = DotState.hoverDot;
  let ghostSpan: {rows: number; cols: number} | undefined;
  if (def.gridSizable && AdvancedComponentState.pendingAnchorDot) {
    // Second half of the two-click span: preview the whole block from its top-left corner,
    // using the same anchor/size math the commit path in select.ts runs.
    const startDot = AdvancedComponentState.pendingAnchorDot;
    const endDot = DotState.hoverDot;
    const topLeft = DotState.dots.find(
      d => d.x === Math.min(startDot.x, endDot.x) && d.y === Math.min(startDot.y, endDot.y)
    );
    if (topLeft) {
      ghostAnchor = topLeft;
      ghostSpan = PlacedAdvancedComponent.gridSpanFromDots(startDot, endDot);
    }
  }

  // Grid-sizable blocks always place unrotated - see the commit path in select.ts.
  const ghostRotation = def.gridSizable ? 0 : AdvancedComponentState.armedRotation;
  const ghost = new PlacedAdvancedComponent(def.id, ghostAnchor, ghostRotation);
  if (ghostSpan) {
    ghost.rows = ghostSpan.rows;
    ghost.cols = ghostSpan.cols;
  }
  Canvas.ctx.save();
  drawAdvancedComponentBody(
    ghost.getPinPositions(), ghost.getShadedPositions(), ghost.getBodyOutline(), ghost.getIconAnchor(),
    def, ghostRotation, {ghost: true}
  );
  Canvas.ctx.restore();
}

function drawWirePlacementPreview() {
  if (!ToolState.armedWire || !DotState.hoverDot) return;

  Canvas.ctx.save();

  if (!ToolState.wireStartDot) {
    // No start dot chosen yet - show a small marker + hint at the hover dot
    Canvas.ctx.beginPath();
    Canvas.ctx.setLineDash([4, 3]);
    Canvas.ctx.strokeStyle = "#38bdf8";
    Canvas.ctx.lineWidth = 2;
    Canvas.ctx.arc(DotState.hoverDot.x, DotState.hoverDot.y, 10, 0, Math.PI * 2);
    Canvas.ctx.stroke();

    Canvas.ctx.setLineDash([]);
    Canvas.ctx.fillStyle = "#ffffff";
    Canvas.ctx.font = "bold 11px Inter, Arial";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.fillText("➕ Start Wire", DotState.hoverDot.x, DotState.hoverDot.y - 16);
  } else if (ToolState.wireStartDot !== DotState.hoverDot) {
    Canvas.ctx.beginPath();
    Canvas.ctx.setLineDash([6, 4]);
    Canvas.ctx.moveTo(ToolState.wireStartDot.x, ToolState.wireStartDot.y);
    Canvas.ctx.lineTo(DotState.hoverDot.x, DotState.hoverDot.y);
    Canvas.ctx.strokeStyle = ToolState.activeWireColor || "#3b82f6";
    Canvas.ctx.lineWidth = ToolState.selectedWireWidth || 4;
    Canvas.ctx.lineCap = "round";
    Canvas.ctx.globalAlpha = 0.55;
    Canvas.ctx.stroke();
  }

  Canvas.ctx.restore();
}

export function redrawCanvas() {
  resetCanvas();
  const selected = PartState.selected;
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
  drawIcPlacementPreview();
  drawStandardComponentPlacementPreview();
  drawAdvancedComponentPlacementPreview();
  drawWirePlacementPreview();
}
