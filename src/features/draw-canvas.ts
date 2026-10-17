import {drawBoard} from "../board-render";
import {Canvas} from "../state/Canvas";
import {DotState} from "../state/DotState";
import {ToolState} from "../state/ToolState";
import {behaviorOf} from "./tools";
import {CanvasPainter} from "./board-canvas/canvas-painter";
import {browserIcons} from "./board-canvas/browser-icons";
import {editorView} from "./board-canvas/editor-view";
import {getSaveJson} from "./project/save-project";

// The board on the page. The board renderer (src/board-render/) draws it from a snapshot of the
// editor's state as a project file, with what the editor marks on it (editorView); the active
// tool's placement preview goes on top. Redrawn from scratch on every change.

// One painter for the page's canvas, so its hole sprites are kept between redraws.
const painter = new CanvasPainter(Canvas.ctx);

// A part icon that finishes loading shows up at the next redraw: ask for one.
browserIcons.onLoad(() => redrawCanvas());

// Run after every redraw. Every change to the board ends in one, so this is how a feature hears
// about changes without each edit having to report itself (autosave uses it).
const redrawListeners: (() => void)[] = [];

export function onRedraw(listener: () => void) {
  redrawListeners.push(listener);
}

export function redrawCanvas() {
  Canvas.ctx.clearRect(0, 0, Canvas.gridWidth, Canvas.gridHeight);
  drawBoard(painter, getSaveJson(), editorView());
  // The active tool's placement preview, over everything.
  const tool = ToolState.active;
  if (DotState.hoverDot) behaviorOf(tool).drawPreview?.(tool, DotState.hoverDot, painter);

  for (const listener of redrawListeners) listener();
}
