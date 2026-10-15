import {Canvas} from "../../state/Canvas";
import {ActiveTool, Rotation, ToolState} from "../../state/ToolState";
import {drawDip} from "../ic-package/dip-shape";
import {drawModule} from "../ic-package/module-shape";
import {placePart} from "../placed-parts";
import {icKey} from "../catalog/catalog-keys";
import {recordRecentKey} from "../catalog/recent-components";
import {ToolBehavior} from "./tool";

type IcTool = Extract<ActiveTool, {kind: "ic"}>;

// One click places a copy of the armed catalog IC with its top-left pin on the pad, then disarms.
export const icTool: ToolBehavior<IcTool> = {
  onPointerDown(tool, {hoverDot}) {
    if (!hoverDot) return false;
    const newInstance = tool.template.clone();
    newInstance.updatePosition(hoverDot.x, hoverDot.y);
    placePart(newInstance);
    // The catalog entry the copy came from, which is what the Components panel lists
    recordRecentKey(icKey(tool.template.armedFrom ?? tool.template));
    ToolState.active = {kind: "select"};
    return true;
  },

  drawPreview(tool, hoverDot) {
    const template = tool.template;
    // The chip or board itself, translucent, where it will land.
    Canvas.ctx.save();
    Canvas.ctx.globalAlpha = 0.65;
    (template.isModule ? drawModule : drawDip)(Canvas.ctx, {
      x: hoverDot.x,
      y: hoverDot.y,
      widthPin: template.widthPin,
      heightPin: template.heightPin,
      rotation: template.rotationAngle as Rotation,
      selected: false,
      title: template.name,
    });
    Canvas.ctx.restore();
  },

  statusText(tool) {
    return `IC Ready: ${tool.template.name} [Click Pad to Place]`;
  },
};
