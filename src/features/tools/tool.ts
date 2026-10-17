import {IDot} from "../../interfaces/dot.interface";
import {ActiveTool} from "../../state/ToolState";
import type {Painter} from "../../board-render";

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
  drawPreview?(tool: T, hoverDot: IDot, painter: Painter): void;
  statusText(tool: T): string;
  // Escape steps back within the tool first (e.g. ends a wire run) and returns true. Returning
  // false, or not implementing this, lets Escape drop the tool and the selection.
  stepBack?(tool: T): boolean;
}

// Dashed ring and hint at the pad a two-click placement would start from.
export function drawStartMarker(painter: Painter, dot: IDot, label: string) {
  painter.circle(dot.x, dot.y, 10, {stroke: {paint: "#38bdf8", width: 2, dash: [4, 3]}});
  painter.text(`➕ ${label}`, dot.x, dot.y - 16, {font: {family: "sans", size: 11, weight: 700}, color: "#ffffff", align: "center"});
}
