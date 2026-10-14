import {Canvas} from "../../state/Canvas";
import {GridConfig} from "../../state/GridConfig";
import {ActiveTool, Rotation, ToolState} from "../../state/ToolState";
import {drawDip} from "../ic-package/dip-shape";
import {placePart} from "../placed-parts";
import {ToolBehavior} from "./tool";

type IcTool = Extract<ActiveTool, {kind: "ic"}>;

// One click places a copy of the armed catalog IC with its top-left pin on the pad, then disarms.
export const icTool: ToolBehavior<IcTool> = {
  onPointerDown(tool, {hoverDot}) {
    if (!hoverDot) return false;
    const newInstance = tool.template.clone();
    newInstance.updatePosition(hoverDot.x, hoverDot.y);
    placePart(newInstance);
    ToolState.active = {kind: "select"};
    return true;
  },

  drawPreview(tool, hoverDot) {
    const template = tool.template;
    if (!template.isModule) {
      // The chip itself, translucent, where it will land.
      Canvas.ctx.save();
      Canvas.ctx.globalAlpha = 0.65;
      drawDip(Canvas.ctx, {
        x: hoverDot.x,
        y: hoverDot.y,
        widthPin: template.widthPin,
        heightPin: template.heightPin,
        rotation: template.rotationAngle as Rotation,
        selected: false,
        title: template.name,
      });
      Canvas.ctx.restore();
      return;
    }

    const w = GridConfig.dotSpace * (tool.template.widthPin - 1);
    const h = GridConfig.dotSpace * (tool.template.heightPin - 1);

    Canvas.ctx.save();
    Canvas.ctx.beginPath();
    Canvas.ctx.fillStyle = "rgba(6, 182, 212, 0.25)";
    Canvas.ctx.strokeStyle = "#38bdf8";
    Canvas.ctx.lineWidth = 2;
    Canvas.ctx.setLineDash([6, 4]);

    Canvas.ctx.rect(hoverDot.x, hoverDot.y, w, h);
    Canvas.ctx.stroke();
    Canvas.ctx.fill();

    // Placement preview label
    Canvas.ctx.setLineDash([]);
    Canvas.ctx.fillStyle = "#ffffff";
    Canvas.ctx.font = "bold 11px Inter, Arial";
    Canvas.ctx.textAlign = "center";
    Canvas.ctx.fillText(`➕ Place ${tool.template.name}`, hoverDot.x + (w / 2), hoverDot.y + (h / 2) + 4);

    Canvas.ctx.restore();
  },

  statusText(tool) {
    return `IC Ready: ${tool.template.name} [Click Pad to Place]`;
  },
};
