import {Canvas} from "../../state/Canvas";
import {HistoryState} from "../../state/HistoryState";
import {LineState} from "../../state/LineState";
import {SelectionState} from "../../state/SelectionState";
import {ActiveTool, ToolState} from "../../state/ToolState";
import {ILine} from "../../interfaces/line.interface";
import {mergeNewWire} from "../wire-merge";
import {drawStartMarker, ToolBehavior} from "./tool";

type WireTool = Extract<ActiveTool, {kind: "wire"}>;

// Two-click span that stays armed for repeated placement, chaining each wire into the next.
export const wireTool: ToolBehavior<WireTool> = {
  onPointerDown(tool, {hoverDot}) {
    if (!hoverDot) return false;
    if (!tool.start) {
      tool.start = hoverDot;
      return true;
    }
    if (tool.start === hoverDot) {
      // Clicking the same pad again ends the run without drawing anything.
      tool.start = undefined;
      return true;
    }
    const newLine: ILine = {
      start: tool.start,
      end: hoverDot,
      color: ToolState.activeWireColor || "#3b82f6",
      width: ToolState.selectedWireWidth || 4
    };
    // Same-color wires that end up collinear and touching (e.g. a chained run) fold into
    // one wire, unless the shared dot is a pin - that endpoint has to stay splittable.
    const {line: placedLine, absorbed} = mergeNewWire(newLine);
    LineState.lines.push(placedLine);
    HistoryState.record(absorbed.length > 0
      ? {type: 'merge', kind: 'line', removed: absorbed, merged: placedLine}
      : {type: 'add', kind: 'line', line: placedLine});
    SelectionState.current = {kind: "line", line: placedLine};
    // Chain the run: the end pad becomes the next wire's start, so a series of
    // connections costs one click per wire instead of two.
    tool.start = hoverDot;
    return true;
  },

  drawPreview(tool, hoverDot) {
    if (!tool.start) {
      drawStartMarker(hoverDot, "Start Wire");
      return;
    }
    if (tool.start === hoverDot) return;
    Canvas.ctx.save();
    Canvas.ctx.beginPath();
    Canvas.ctx.setLineDash([6, 4]);
    Canvas.ctx.moveTo(tool.start.x, tool.start.y);
    Canvas.ctx.lineTo(hoverDot.x, hoverDot.y);
    Canvas.ctx.strokeStyle = ToolState.activeWireColor || "#3b82f6";
    Canvas.ctx.lineWidth = ToolState.selectedWireWidth || 4;
    Canvas.ctx.lineCap = "round";
    Canvas.ctx.globalAlpha = 0.55;
    Canvas.ctx.stroke();
    Canvas.ctx.restore();
  },

  statusText(tool) {
    return tool.start
      ? `Wiring Run [Click next pad • Same pad or Esc to end run]`
      : `Wire Tool Armed [Click start pad]`;
  },

  // Mid-run, Escape only breaks the chain and leaves the wire tool armed, so ending a run does
  // not cost a re-arm. A second press disarms it.
  stepBack(tool) {
    if (!tool.start) return false;
    tool.start = undefined;
    return true;
  },
};
