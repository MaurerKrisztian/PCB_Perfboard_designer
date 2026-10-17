// A placed part's rotation, clockwise on the board (y grows downwards). The same values as the
// project file's Rotation.
export type Rotation = 0 | 90 | 180 | 270;

// An offset from a part's anchor, in grid units, turned with the part.
export function rotateOffset(dx: number, dy: number, angle: Rotation): {x: number; y: number} {
  switch (angle) {
    case 90: return {x: -dy, y: dx};
    case 180: return {x: -dx, y: -dy};
    case 270: return {x: dy, y: -dx};
    default: return {x: dx, y: dy};
  }
}
