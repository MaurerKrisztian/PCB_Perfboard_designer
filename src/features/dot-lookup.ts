import {IDot} from "../interfaces/dot.interface";
import {DotState} from "../state/DotState";

// Dot nearest to a canvas point, used to snap a placement or a drag onto the grid.
export function findNearestDot(x: number, y: number): IDot | undefined {
  let minDistance: number | null = null;
  let minDot: IDot | undefined = undefined;
  for (const dot of DotState.dots) {
    const dx = dot.x - x;
    const dy = dot.y - y;
    const distance = dx * dx + dy * dy;
    if (minDistance === null || distance < minDistance) {
      minDistance = distance;
      minDot = dot;
    }
  }
  return minDot;
}

// Dot at exactly these coordinates, or undefined when the position is off the grid. Dots sit at
// dotSpace/2 + k * dotSpace (see createDotGrid) and callers only ever ask about positions derived
// from a dot plus a whole number of dotSpace steps, so exact equality is safe here.
export function findDotAt(x: number, y: number): IDot | undefined {
  return DotState.dots.find(dot => dot.x === x && dot.y === y);
}

// Same lookup keyed by position, for callers that test many positions against an unchanging grid
// (a drag). Building it once beats scanning DotState.dots per pin, per mouse move.
export function dotPositionKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function buildDotIndex(): Map<string, IDot> {
  const index = new Map<string, IDot>();
  for (const dot of DotState.dots) {
    index.set(dotPositionKey(dot.x, dot.y), dot);
  }
  return index;
}
