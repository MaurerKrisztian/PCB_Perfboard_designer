import type {Point} from "./advanced-component-render";

export function rotateOffset(dx: number, dy: number, angle: 0 | 90 | 180 | 270): Point {
  switch (angle) {
    case 90: return {x: -dy, y: dx};
    case 180: return {x: -dx, y: -dy};
    case 270: return {x: dy, y: -dx};
    default: return {x: dx, y: dy};
  }
}
