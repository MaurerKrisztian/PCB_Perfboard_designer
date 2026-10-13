import {Canvas} from "../../state/Canvas";
import {BoardState} from "../../state/BoardState";
import {HistoryState} from "../../state/HistoryState";
import {ActiveTool} from "../../state/ToolState";
import {ToolBehavior} from "./tool";

type CutTool = Extract<ActiveTool, {kind: "cut"}>;

const PREVIEW_RADIUS = 20;
const CUT_PREVIEW_COLOR = "#f87171";
const MEND_PREVIEW_COLOR = "#4ade80";

// Stripboard only (its toolbar button is hidden on a perfboard): a click on a hole cuts the strip
// there, and a click on a cut hole mends it.
export const cutTool: ToolBehavior<CutTool> = {
  onPointerDown(_tool, {hoverDot}) {
    if (!hoverDot || !BoardState.isStripboard) return true;
    hoverDot.cut = !hoverDot.cut;
    HistoryState.record({type: "set", kind: "cut", dot: hoverDot, cut: hoverDot.cut});
    return true;
  },

  drawPreview(_tool, hoverDot) {
    if (!BoardState.isStripboard) return;
    const color = hoverDot.cut ? MEND_PREVIEW_COLOR : CUT_PREVIEW_COLOR;
    const ctx = Canvas.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.arc(hoverDot.x, hoverDot.y, PREVIEW_RADIUS, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = color;
    ctx.font = "bold 11px Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText(hoverDot.cut ? "Mend strip" : "✂ Cut strip", hoverDot.x, hoverDot.y - PREVIEW_RADIUS - 6);
    ctx.restore();
  },

  statusText: () => "Tool: CUT Mode [Click hole to cut / mend]",
};
