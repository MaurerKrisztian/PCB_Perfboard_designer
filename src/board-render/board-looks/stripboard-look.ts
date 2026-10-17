import {gridToPx, GRID_PITCH_PX} from "../../project-file/grid";
import {CUT_GAP_PITCH, STRIP_WIDTH_PITCH} from "../../project-file/stripboard-geometry";
import {BoardLook} from "./board-look";
import {COPPER_COLOR, HOLE_COLOR, HOLE_RADIUS} from "../palette";

// Stripboard: a brown (SRBP) board with long copper strips, one per row or column, each
// connecting every hole along it. Shown through the board, as stripboard layouts usually are.
// A cut is a gap of bare board across the strip at the cut hole, breaking the strip in two (the
// 3D viewer draws the same gap, from the same sizes).

export const STRIPBOARD_COLOR = "#5c3b1e";
const STRIP_WIDTH = STRIP_WIDTH_PITCH * GRID_PITCH_PX;
const CUT_GAP = CUT_GAP_PITCH * GRID_PITCH_PX;

export const stripboardLook: BoardLook = {
  paintBoard(painter, board, width, height) {
    painter.rect(0, 0, width, height, {fill: STRIPBOARD_COLOR});
    if (board.type !== "stripboard") return;
    const horizontal = board.strips === "horizontal";
    const pitch = GRID_PITCH_PX;
    if (horizontal) {
      for (let y = pitch / 2; y < height; y += pitch) painter.rect(0, y - STRIP_WIDTH / 2, width, STRIP_WIDTH, {fill: COPPER_COLOR});
    } else {
      for (let x = pitch / 2; x < width; x += pitch) painter.rect(x - STRIP_WIDTH / 2, 0, STRIP_WIDTH, height, {fill: COPPER_COLOR});
    }
    // A pixel past the strip's edges on both sides, so no copper sliver is left by antialiasing.
    const across = STRIP_WIDTH + 2;
    for (const [col, row] of board.cuts) {
      const x = gridToPx(col), y = gridToPx(row);
      if (horizontal) painter.rect(x - CUT_GAP / 2, y - across / 2, CUT_GAP, across, {fill: STRIPBOARD_COLOR});
      else painter.rect(x - across / 2, y - CUT_GAP / 2, across, CUT_GAP, {fill: STRIPBOARD_COLOR});
    }
  },

  // The strip is the copper, so a hole is just the drilled hole.
  hole: {
    id: "stripboard-hole",
    radius: HOLE_RADIUS,
    draw(painter) {
      painter.circle(0, 0, HOLE_RADIUS, {fill: HOLE_COLOR});
    },
  },
};
