import {DotState} from "../state/DotState";
import {LineState} from "../state/LineState";
import {GridConfig} from "../state/GridConfig";
import {SelectionState} from "../state/SelectionState";
import {ILine} from "../interfaces/line.interface";
import {beginDrag} from "./component-drag";
import {findPartAt} from "./placed-parts";

// Selecting pads, wires and parts by clicking them. Nothing here redraws: callers do, once.

// Perpendicular distance from (x,y) to the segment, clamped to the segment itself - used to
// rank "how close is this click to this wire" rather than just "is it within tolerance."
function distanceToSegment(x: number, y: number, line: ILine): number {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(x - line.start.x, y - line.start.y);
  }
  const t = Math.max(0, Math.min(1, ((x - line.start.x) * dx + (y - line.start.y) * dy) / lengthSq));
  return Math.hypot(x - (line.start.x + t * dx), y - (line.start.y + t * dy));
}

function findLineAt(x: number, y: number): ILine | undefined {
  let closest: ILine | undefined;
  let closestDistance = GridConfig.lineSelectTolerance;
  for (const line of LineState.lines) {
    const distance = distanceToSegment(x, y, line);
    if (distance < closestDistance) {
      closest = line;
      closestDistance = distance;
    }
  }
  return closest;
}

// A hovered dot only outranks a wire under the cursor when the click actually lands on the
// dot itself (dotClickPriorityRadius) - otherwise the dot's generous hover/snap radius would
// swallow clicks on most of a short wire, since wires span only 50px between dots.
function dotOutranksLineAt(x: number, y: number): boolean {
  if (!DotState.hoverDot) {
    return false;
  }
  return Math.hypot(x - DotState.hoverDot.x, y - DotState.hoverDot.y) <= GridConfig.dotClickPriorityRadius;
}

// Selects the wire at (x, y), if a dot doesn't outrank it; otherwise drops a wire selection.
export function selectLine(x: number, y: number) {
  const line = dotOutranksLineAt(x, y) ? undefined : findLineAt(x, y);
  if (line) {
    SelectionState.current = {kind: "line", line};
  } else {
    SelectionState.clear("line");
  }
}

// Selects the wire or else the hovered pad at (x, y).
export function setSelection(x: number, y: number) {
  if (!dotOutranksLineAt(x, y)) {
    const line = findLineAt(x, y);
    if (line) {
      SelectionState.current = {kind: "line", line};
      return;
    }
  }

  if (DotState.hoverDot) {
    SelectionState.current = {kind: "dot", dot: DotState.hoverDot};
  } else {
    SelectionState.clear("line");
  }
}

// A plain click: picks up the part under the pointer (when allowed) to select and drag it, or
// else selects the wire or pad there.
export function selectAt(x: number, y: number, pickUpParts: boolean) {
  if (pickUpParts) {
    const part = findPartAt(x, y);
    if (part) {
      SelectionState.current = {kind: "part", part};
      beginDrag(part, x, y);
      return;
    }
    // Missed every part: drop the part selection and fall through to dot/line selection.
    SelectionState.clear("part");
  }
  setSelection(x, y);
}
