import {Canvas} from "../state/Canvas";
import {NetHighlightState} from "../state/NetHighlightState";
import {PAD_RADIUS} from "./board-looks/board-look";
import {gridToPx} from "../project-file/grid";

// The net picked in the Nets panel (nets-panel.ts) on the board: a glow along its wires and a ring
// on every hole, drawn over everything so it shows through parts sitting on it.

// Same as --net-highlight in style.css, which marks the picked net in the panel.
const NET_HIGHLIGHT_COLOR = "#e879f9";
const DEFAULT_WIRE_WIDTH = 4;

export function drawNetHighlight() {
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
    ctx.lineWidth = (wire.width || DEFAULT_WIRE_WIDTH) + 8;
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
