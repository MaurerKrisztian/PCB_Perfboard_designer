import {Canvas} from "../../state/Canvas";
import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";
import {applyCanvasResolution} from "../canvas-sizing";
import {redrawCanvas} from "../draw-canvas";
import {getCurrentZoom} from "../view-controls";

// Fixed resolution multiplier for exports, independent of the current zoom/DPR,
// so the PNG is always the same crisp resolution regardless of what the user is viewing.
const EXPORT_SCALE = 2;

Utils.getSafeHtmlElement<HTMLButtonElement>('downloadBtn').addEventListener('click', function() {
 downloadAsImage()
});

export function downloadAsImage(){
  const zoom = getCurrentZoom();

  Canvas.c.width = Canvas.gridWidth * EXPORT_SCALE;
  Canvas.c.height = Canvas.gridHeight * EXPORT_SCALE;
  Canvas.ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
  redrawCanvas();

  const link = document.createElement('a');
  link.download = 'canvas.png';
  link.href = Canvas.c.toDataURL();
  link.click();

  applyCanvasResolution(zoom);
  redrawCanvas();
}

ShortcutRegistry.add({key: "p", description: "download as image", event: downloadAsImage})
