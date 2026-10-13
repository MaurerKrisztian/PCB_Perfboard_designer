import {Canvas} from "../../state/Canvas";
import {IDot} from "../../interfaces/dot.interface";

// How the bare board is drawn. Each board type has its own look (perfboard-look.ts,
// stripboard-look.ts), picked by activeBoardLook() in index.ts. Purely visual: hit testing still
// uses GridConfig.dotRadius and friends, and what's connected is the board type's business, not
// the look's.
export interface BoardLook {
  // The bare board, plus any copper shared by several holes (a stripboard's strips). Painted
  // first, under everything else.
  paintBoard(width: number, height: number): void;
  drawHole(dot: IDot): void;
}

// The color every dot starts with; any other color means the user marked that hole.
export const DEFAULT_DOT_COLOR = "#a4a0a0";

// In drawing pixels, where one hole pitch is GridConfig.dotSpace (50px). The copper ring around a
// hole: a perfboard's pad, or a marked hole on either board. Hover and selection rings are sized
// from it.
export const PAD_RADIUS = 10.5;
export const HOLE_RADIUS = 6.3;
export const COPPER_COLOR = "#b7733b";
export const HOLE_COLOR = "#0a170b";

export function markColorOf(dot: IDot): string | undefined {
  return dot.color && dot.color.toLowerCase() !== DEFAULT_DOT_COLOR ? dot.color : undefined;
}

export function drawMarkedHole(dot: IDot, color: string) {
  const ctx = Canvas.ctx;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, PAD_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HOLE_COLOR;
  ctx.beginPath();
  ctx.arc(dot.x, dot.y, HOLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
