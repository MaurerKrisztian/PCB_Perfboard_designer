import {Canvas} from "../../state/Canvas";
import {BoardLook, COPPER_COLOR, drawMarkedHole, HOLE_COLOR, HOLE_RADIUS, markColorOf, PAD_RADIUS} from "./board-look";
import {HoleStamp} from "./hole-stamp";

// Perfboard: a flat dark-green board with a separate copper pad around every hole.

const BOARD_COLOR = "#046307";

const padStamp = new HoleStamp(PAD_RADIUS, (ctx, center, scale) => {
  ctx.fillStyle = COPPER_COLOR;
  ctx.beginPath();
  ctx.arc(center, center, PAD_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = HOLE_COLOR;
  ctx.beginPath();
  ctx.arc(center, center, HOLE_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();
});

export const perfboardLook: BoardLook = {
  paintBoard(width, height) {
    Canvas.ctx.fillStyle = BOARD_COLOR;
    Canvas.ctx.fillRect(0, 0, width, height);
  },

  drawHole(dot) {
    const markColor = markColorOf(dot);
    if (markColor) drawMarkedHole(dot, markColor);
    else padStamp.draw(dot.x, dot.y);
  },
};
