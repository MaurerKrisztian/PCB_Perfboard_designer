import {IDot} from "../interfaces/dot.interface";
import {IDragTarget} from "../interfaces/drag-target.interface";
import {Canvas} from "../state/Canvas";
import {DragState} from "../state/DragState";
import {GridConfig} from "../state/GridConfig";
import {HistoryState} from "../state/HistoryState";
import {Point} from "./advanced-components/advanced-component-render";
import {buildDotIndex, dotPositionKey, findNearestDot} from "./dot-lookup";

// Dots the part is pinned to, in a fixed order per kind. Everything else a part draws is derived
// from these, so translating them is the whole move.
export function getAnchorDots(target: IDragTarget): IDot[] {
  if (target.kind === "ic") {
    return target.ic.topLeftDot ? [target.ic.topLeftDot] : [];
  }
  if (target.kind === "standard-component") {
    return [target.component.startDot, target.component.endDot];
  }
  return [target.component.anchorDot];
}

export function setAnchorDots(target: IDragTarget, dots: IDot[]) {
  if (target.kind === "ic") {
    if (dots[0]) target.ic.topLeftDot = dots[0];
    return;
  }
  if (target.kind === "standard-component") {
    if (dots[0]) target.component.startDot = dots[0];
    if (dots[1]) target.component.endDot = dots[1];
    return;
  }
  if (dots[0]) target.component.anchorDot = dots[0];
}

// Every grid hole the part sits on. A move is only allowed when all of them land on real dots,
// so a part can never be dragged half off the board.
function getOccupiedPositions(target: IDragTarget): Point[] {
  if (target.kind === "ic") {
    const topLeft = target.ic.topLeftDot;
    if (!topLeft) return [];
    // The grid is regular, so the footprint's four corners standing on dots implies the rest do.
    const w = GridConfig.dotSpace * (target.ic.widthPin - 1);
    const h = GridConfig.dotSpace * (target.ic.heightPin - 1);
    return [
      {x: topLeft.x, y: topLeft.y},
      {x: topLeft.x + w, y: topLeft.y},
      {x: topLeft.x, y: topLeft.y + h},
      {x: topLeft.x + w, y: topLeft.y + h},
    ];
  }
  if (target.kind === "standard-component") {
    const {startDot, endDot} = target.component;
    return [{x: startDot.x, y: startDot.y}, {x: endDot.x, y: endDot.y}];
  }
  // Pin and shaded-hole positions already account for rotation and rows/cols.
  return [...target.component.getPinPositions(), ...target.component.getShadedPositions()];
}

export function beginDrag(target: IDragTarget, x: number, y: number) {
  const anchors = getAnchorDots(target);
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
  const occupied = getOccupiedPositions(target);
  for (const position of occupied) {
    const isOnGrid = dotIndex.has(dotPositionKey(position.x, position.y));
    if (isOnGrid && !dotIndex.has(dotPositionKey(position.x + deltaX, position.y + deltaY))) {
      return false;
    }
  }

  // Anchors have to be the shared DotState.dots objects: save/load re-links by them and the grid
  // drawing compares dots by reference.
  const movedAnchors: IDot[] = [];
  for (const anchor of getAnchorDots(target)) {
    const moved = dotIndex.get(dotPositionKey(anchor.x + deltaX, anchor.y + deltaY));
    if (!moved) return false;
    movedAnchors.push(moved);
  }

  setAnchorDots(target, movedAnchors);
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
    const to = getAnchorDots(target);
    HistoryState.changes.splice(HistoryState.changeIndex + 1);
    if (target.kind === "ic") {
      HistoryState.changes.push({type: 'move', kind: 'ic', ic: target.ic, from: originDots, to});
    } else if (target.kind === "standard-component") {
      HistoryState.changes.push({type: 'move', kind: 'standard-component', component: target.component, from: originDots, to});
    } else {
      HistoryState.changes.push({type: 'move', kind: 'advanced-component', component: target.component, from: originDots, to});
    }
    HistoryState.changeIndex++;
  }
  clearDrag();
}

// Abandon a drag in progress, putting the part back where it was picked up.
export function cancelDrag() {
  const {target, originDots} = DragState;
  if (target && originDots && DragState.moved) {
    setAnchorDots(target, originDots);
  }
  clearDrag();
}
