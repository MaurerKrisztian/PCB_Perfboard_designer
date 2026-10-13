import {Canvas} from "../../state/Canvas";
import {BoardState} from "../../state/BoardState";
import {DotState} from "../../state/DotState";
import {GridConfig} from "../../state/GridConfig";
import {CUT_GAP_PITCH, STRIP_WIDTH_PITCH} from "../../project-file/stripboard-geometry";
import {BoardLook, COPPER_COLOR, drawMarkedHole, HOLE_COLOR, HOLE_RADIUS, markColorOf} from "./board-look";
import {HoleStamp} from "./hole-stamp";

// Stripboard: a brown (SRBP) board with long copper strips, one per row or column, each
// connecting every hole along it. Shown through the board, as stripboard layouts usually are.
// A cut is a gap of bare board across the strip at the cut hole, breaking the strip in two (the
// 3D viewer draws the same gap, from the same sizes).

const BOARD_COLOR = "#5c3b1e";
const STRIP_WIDTH = STRIP_WIDTH_PITCH * GridConfig.dotSpace;
const CUT_GAP = CUT_GAP_PITCH * GridConfig.dotSpace;

// The strip is the copper, so a hole is just the drilled hole.
const holeStamp = new HoleStamp(HOLE_RADIUS, (ctx, center, scale) => {
  ctx.fillStyle = HOLE_COLOR;
  ctx.beginPath();
  ctx.arc(center, center, HOLE_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();
});

function paintStrips(width: number, height: number) {
  const ctx = Canvas.ctx;
  const pitch = GridConfig.dotSpace;
  ctx.fillStyle = COPPER_COLOR;
  if (BoardState.setup.strips === "horizontal") {
    for (let y = pitch / 2; y < height; y += pitch) ctx.fillRect(0, y - STRIP_WIDTH / 2, width, STRIP_WIDTH);
  } else {
    for (let x = pitch / 2; x < width; x += pitch) ctx.fillRect(x - STRIP_WIDTH / 2, 0, STRIP_WIDTH, height);
  }
}

function paintCuts() {
  const ctx = Canvas.ctx;
  const horizontal = BoardState.setup.strips === "horizontal";
  const along = CUT_GAP;
  // A pixel past the strip's edges on both sides, so no copper sliver is left by antialiasing.
  const across = STRIP_WIDTH + 2;
  ctx.fillStyle = BOARD_COLOR;
  for (const dot of DotState.dots) {
    if (!dot.cut) continue;
    if (horizontal) ctx.fillRect(dot.x - along / 2, dot.y - across / 2, along, across);
    else ctx.fillRect(dot.x - across / 2, dot.y - along / 2, across, along);
  }
}

export const stripboardLook: BoardLook = {
  paintBoard(width, height) {
    Canvas.ctx.fillStyle = BOARD_COLOR;
    Canvas.ctx.fillRect(0, 0, width, height);
    paintStrips(width, height);
    paintCuts();
  },

  drawHole(dot) {
    const markColor = markColorOf(dot);
    if (markColor) drawMarkedHole(dot, markColor);
    else holeStamp.draw(dot.x, dot.y);
  },
};
