import {IDot} from "../../interfaces/dot.interface";
import {ActiveTool} from "../../state/ToolState";
import {Canvas} from "../../state/Canvas";

export interface BoardClick {
  // Drawing-space coordinates of the click.
  x: number;
  y: number;
  // The pad the click snaps to, if it's close enough to one.
  hoverDot?: IDot;
}

// What one kind of ActiveTool does. Tools only change state; the caller redraws and refreshes the
// status badge afterwards, so a tool never has to remember to.
export interface ToolBehavior<T extends ActiveTool> {
  // A left click on the board. Returns false when the tool has nothing to do with the click (a
  // placement tool clicked away from any pad), which then falls back to plain selection.
  onPointerDown(tool: T, click: BoardClick): boolean;
  // Drawn last, above everything on the board, while the pointer is over a pad.
  drawPreview?(tool: T, hoverDot: IDot): void;
  statusText(tool: T): string;
  // Escape steps back within the tool first (e.g. ends a wire run) and returns true. Returning
  // false, or not implementing this, lets Escape drop the tool and the selection.
  stepBack?(tool: T): boolean;
}

// Dashed ring and hint at the pad a two-click placement would start from.
export function drawStartMarker(dot: IDot, label: string) {
  Canvas.ctx.save();
  Canvas.ctx.beginPath();
  Canvas.ctx.setLineDash([4, 3]);
  Canvas.ctx.strokeStyle = "#38bdf8";
  Canvas.ctx.lineWidth = 2;
  Canvas.ctx.arc(dot.x, dot.y, 10, 0, Math.PI * 2);
  Canvas.ctx.stroke();

  Canvas.ctx.setLineDash([]);
  Canvas.ctx.fillStyle = "#ffffff";
  Canvas.ctx.font = "bold 11px Inter, Arial";
  Canvas.ctx.textAlign = "center";
  Canvas.ctx.fillText(`➕ ${label}`, dot.x, dot.y - 16);
  Canvas.ctx.restore();
}
