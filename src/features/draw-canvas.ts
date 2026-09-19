import {resetCanvas} from "./reset-canvas";
import {GridConfig} from "../state/GridConfig";
import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {IcState} from "../state/IcState";
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

function drawDot(dot: IDot){
  Canvas.ctx.beginPath();
  Canvas.ctx.arc(dot.x, dot.y, GridConfig.dotRadius, 0, Math.PI*2);
  Canvas.ctx.fillStyle = dot.color || "#a4a0a0";
  Canvas.ctx.fill();

  if (dot === DotState.selectedDot) {
    // Outer glowing selection ring
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, GridConfig.dotRadius + 4, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#38bdf8";
    Canvas.ctx.lineWidth = 3;
    Canvas.ctx.stroke();

    // Inner ring marker
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, GridConfig.dotRadius + 1, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#ffffff";
    Canvas.ctx.lineWidth = 1.5;
    Canvas.ctx.stroke();
  } else if (dot === ToolState.wireStartDot || dot === StandardComponentState.pendingStartDot) {
    // Pending placement start pad highlight
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, GridConfig.dotRadius + 4, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#22c55e";
    Canvas.ctx.lineWidth = 3;
    Canvas.ctx.stroke();
  } else if (dot === DotState.hoverDot) {
    Canvas.ctx.beginPath();
    Canvas.ctx.arc(dot.x, dot.y, GridConfig.dotRadius + 3, 0, Math.PI * 2);
    Canvas.ctx.strokeStyle = "#94a3b8";
    Canvas.ctx.lineWidth = 2;
    Canvas.ctx.stroke();
  }



  if (dot.description) {
    Canvas.ctx.font = "10px Inter, Arial";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.fillStyle = dot.color || "#38bdf8";
    if (dot === DotState.hoverDot) {
      Canvas.ctx.fillText(dot.description, dot.x, dot.y + GridConfig.dotRadius + 12);
    } else {
      Canvas.ctx.fillText(dot.description.substring(0, 5), dot.x, dot.y + GridConfig.dotRadius + 12);
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

  const ghost = new PlacedAdvancedComponent(def.id, DotState.hoverDot, AdvancedComponentState.armedRotation);
  Canvas.ctx.save();
  drawAdvancedComponentBody(
    ghost.getPinPositions(), ghost.getShadedPositions(), ghost.getBodyOutline(), ghost.getIconAnchor(),
    def, AdvancedComponentState.armedRotation, {ghost: true}
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
  // 1. Draw IC chip bodies
  for (const ic of IcState.placedIcs) {
    ic.drawBody();
  }
  // 2. Draw grid dots
  for (let i = 0; i < DotState.dots.length; i++) {
    drawDot(DotState.dots[i]);
  }
  // 3. Draw wires
  for (let i = 0; i < LineState.lines.length; i++) {
    drawLine(LineState.lines[i]);
  }
  // 4. Draw Standard Component bodies (above wires/dots, IC chip bodies stay underneath)
  for (const component of StandardComponentState.placedComponents) {
    component.draw();
  }
  // 5. Draw Advanced (fixed-pin) Component bodies
  for (const component of AdvancedComponentState.placedComponents) {
    component.draw();
  }
  // 6. Draw IC text badges on top of everything
  for (const ic of IcState.placedIcs) {
    ic.drawLabel();
  }
  drawIcPlacementPreview();
  drawStandardComponentPlacementPreview();
  drawAdvancedComponentPlacementPreview();
  drawWirePlacementPreview();
}
