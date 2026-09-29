import {ILine} from "../interfaces/line.interface";
import {IDot} from "../interfaces/dot.interface";
import {LineState} from "../state/LineState";
import {IcState} from "../state/IcState";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {Utils} from "../utils/utils";

function dotsEqual(a: IDot, b: IDot): boolean {
  return a.x === b.x && a.y === b.y;
}

function sameColor(a?: string, b?: string): boolean {
  return Utils.normalizeColor(a) === Utils.normalizeColor(b);
}

// True when a component lead terminates on this dot. A wire ending there has to stay its own
// segment - folding it into a neighbor would make the pin's connection un-splittable later.
function isPinDot(dot: IDot): boolean {
  for (const ic of IcState.placedIcs) {
    if (ic.getRealPinPositions().some(p => p.x === dot.x && p.y === dot.y)) return true;
  }
  for (const component of StandardComponentState.placedComponents) {
    if (dotsEqual(component.startDot, dot) || dotsEqual(component.endDot, dot)) return true;
  }
  for (const component of AdvancedComponentState.placedComponents) {
    if (component.getPinPositions().some(p => p.x === dot.x && p.y === dot.y)) return true;
  }
  return false;
}

// Folds `newLine` into any same-color wire(s) it forms a straight line with at its endpoints
// (chained through as many collinear segments as line up), unless the shared dot is a pin. The
// absorbed wires are removed from LineState.lines; the caller records one history entry for the
// whole merge and pushes the returned line in place of `newLine`.
export function mergeNewWire(newLine: ILine): {line: ILine; absorbed: ILine[]} {
  const dx = newLine.end.x - newLine.start.x;
  const dy = newLine.end.y - newLine.start.y;
  const absorbed: ILine[] = [];
  let start = newLine.start;
  let end = newLine.end;

  const findNeighbor = (dot: IDot): ILine | undefined => {
    if (isPinDot(dot)) return undefined;
    return LineState.lines.find(candidate => {
      if (absorbed.indexOf(candidate) > -1) return false;
      if (!sameColor(candidate.color, newLine.color)) return false;
      const cdx = candidate.end.x - candidate.start.x;
      const cdy = candidate.end.y - candidate.start.y;
      // Parallel direction through a shared point is the same infinite line.
      if (dx * cdy - dy * cdx !== 0) return false;
      return dotsEqual(candidate.start, dot) || dotsEqual(candidate.end, dot);
    });
  };

  let neighbor = findNeighbor(start);
  while (neighbor) {
    start = dotsEqual(neighbor.start, start) ? neighbor.end : neighbor.start;
    absorbed.push(neighbor);
    neighbor = findNeighbor(start);
  }

  neighbor = findNeighbor(end);
  while (neighbor) {
    end = dotsEqual(neighbor.start, end) ? neighbor.end : neighbor.start;
    absorbed.push(neighbor);
    neighbor = findNeighbor(end);
  }

  if (absorbed.length === 0) {
    return {line: newLine, absorbed};
  }

  for (const line of absorbed) {
    const index = LineState.lines.indexOf(line);
    if (index > -1) LineState.lines.splice(index, 1);
  }

  return {line: {start, end, color: newLine.color, width: newLine.width}, absorbed};
}
