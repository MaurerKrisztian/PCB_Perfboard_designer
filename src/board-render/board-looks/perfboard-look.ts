import {BoardLook} from "./board-look";
import {COPPER_COLOR, HOLE_COLOR, HOLE_RADIUS, PAD_RADIUS} from "../palette";

// Perfboard: a flat dark-green board with a separate copper pad around every hole.

export const PERFBOARD_COLOR = "#046307";

export const perfboardLook: BoardLook = {
  paintBoard(painter, _board, width, height) {
    painter.rect(0, 0, width, height, {fill: PERFBOARD_COLOR});
  },

  hole: {
    id: "perfboard-hole",
    radius: PAD_RADIUS,
    draw(painter) {
      painter.circle(0, 0, PAD_RADIUS, {fill: COPPER_COLOR});
      painter.circle(0, 0, HOLE_RADIUS, {fill: HOLE_COLOR});
    },
  },
};
