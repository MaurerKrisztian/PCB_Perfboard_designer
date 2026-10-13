import {IDot} from "../interfaces/dot.interface";
import type {Part} from "../interfaces/placed-part.interface";
import {Canvas} from "../state/Canvas";
import {DragState} from "../state/DragState";
import {HistoryState} from "../state/HistoryState";
import {buildDotIndex, dotPositionKey, findNearestDot} from "./dot-lookup";

export function beginDrag(target: Part, x: number, y: number) {
  const anchors = target.getAnchorDots();
  if (!anchors.length) return;
  const grabDot = findNearestDot(x, y);
  if (!grabDot) return;
  DragState.target = target;
  DragState.grabDot = grabDot;
  DragState.originDots = anchors;
  DragState.dotIndex = buildDotIndex();
  DragState.moved = false;
  Canvas.c.style.cursor = 'grabbing';
}

// Moves the dragged part to follow the cursor. Returns whether anything actually changed, so the
// caller only repaints when it has to.
export function updateDrag(x: number, y: number): boolean {
  const {target, grabDot, dotIndex} = DragState;
  if (!target || !grabDot || !dotIndex) return false;

  const nearestDot = findNearestDot(x, y);
  if (!nearestDot) return false;
  const deltaX = nearestDot.x - grabDot.x;
  const deltaY = nearestDot.y - grabDot.y;
  if (deltaX === 0 && deltaY === 0) return false;

  // Reject the whole step if a hole the part covers would fall off the grid, leaving grabDot where
  // it was so the part picks the cursor back up once it's dragged inside the board again.
  // Holes that are *already* off the grid are exempt: placement never checked that a part fits,
  // so a part placed overhanging an edge would otherwise be impossible to drag anywhere at all.
  const occupied = target.getOccupiedPositions();
  for (const position of occupied) {
    const isOnGrid = dotIndex.has(dotPositionKey(position.x, position.y));
    if (isOnGrid && !dotIndex.has(dotPositionKey(position.x + deltaX, position.y + deltaY))) {
      return false;
    }
  }

  // Anchors have to be the shared DotState.dots objects: save/load re-links by them and the grid
  // drawing compares dots by reference.
  const movedAnchors: IDot[] = [];
  for (const anchor of target.getAnchorDots()) {
    const moved = dotIndex.get(dotPositionKey(anchor.x + deltaX, anchor.y + deltaY));
    if (!moved) return false;
    movedAnchors.push(moved);
  }

  target.setAnchorDots(movedAnchors);
  DragState.grabDot = nearestDot;
  DragState.moved = true;
  return true;
}

function clearDrag() {
  // Only hand the cursor back if a drag actually owned it - endDrag runs on every mouseup, and
  // the board pan sets its own cursor.
  if (DragState.target) {
    Canvas.c.style.cursor = 'crosshair';
  }
  DragState.target = undefined;
  DragState.grabDot = undefined;
  DragState.originDots = undefined;
  DragState.dotIndex = undefined;
  DragState.moved = false;
}

export function endDrag() {
  const {target, originDots, moved} = DragState;
  if (target && originDots && moved) {
    HistoryState.record({type: 'move', kind: 'part', part: target, from: originDots, to: target.getAnchorDots()});
  }
  clearDrag();
}

// Abandon a drag in progress, putting the part back where it was picked up.
export function cancelDrag() {
  const {target, originDots} = DragState;
  if (target && originDots && DragState.moved) {
    target.setAnchorDots(originDots);
  }
  clearDrag();
}
