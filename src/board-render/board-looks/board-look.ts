import {SavedBoard} from "../../project-file/project-file";
import {Painter, Stamp} from "../painter/painter";
import {HOLE_COLOR, HOLE_RADIUS, PAD_RADIUS} from "../palette";

// How a bare board is drawn. Each board type has its own look (perfboard-look.ts,
// stripboard-look.ts), picked by boardLookFor() in index.ts. Purely visual: what's connected is
// the nets code's business (src/project-file/nets.ts), not the look's.
export interface BoardLook {
  // The board itself, plus any copper shared by several holes (a stripboard's strips and their
  // cuts). Painted first, under everything else.
  paintBoard(painter: Painter, board: SavedBoard, width: number, height: number): void;
  // An unmarked hole, stamped at every hole that has nothing on top hiding it.
  hole: Stamp;
}

// A hole the user marked: a copper ring in their colour, on either board.
export function drawMarkedHole(painter: Painter, x: number, y: number, color: string) {
  painter.circle(x, y, PAD_RADIUS, {fill: color});
  painter.circle(x, y, HOLE_RADIUS, {fill: HOLE_COLOR});
}
