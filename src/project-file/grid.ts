// Project files store grid positions; the editor and the 3D viewer draw in pixels, with one hole
// per GRID_PITCH_PX cell and each hole centered in its cell.
export const GRID_PITCH_PX = 50;
const FIRST_HOLE_PX = GRID_PITCH_PX / 2;

// [column, row] of a hole, counted from the top-left hole.
export type GridPos = [number, number];

export function gridToPx(index: number): number {
  return FIRST_HOLE_PX + index * GRID_PITCH_PX;
}

// The grid index of a pixel coordinate that sits exactly on a hole, else undefined.
export function pxToGrid(px: number): number | undefined {
  const index = (px - FIRST_HOLE_PX) / GRID_PITCH_PX;
  return Number.isInteger(index) ? index : undefined;
}

// Grid position of a point the editor knows is a hole (every anchor is one of its dots).
export function toGridPos(point: {x: number; y: number}): GridPos {
  return [Math.round((point.x - FIRST_HOLE_PX) / GRID_PITCH_PX), Math.round((point.y - FIRST_HOLE_PX) / GRID_PITCH_PX)];
}

// How many holes fit along a board edge this many pixels long.
export function holesAlong(px: number): number {
  return Math.max(0, Math.ceil((px - FIRST_HOLE_PX) / GRID_PITCH_PX));
}
