import {IDragTarget} from "../interfaces/drag-target.interface";
import {IChange} from "../interfaces/change.interface";
import {IcState} from "../state/IcState";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {HistoryState} from "../state/HistoryState";

// Helpers that treat the three placement systems (ICs, standard and advanced components) alike,
// so callers don't each re-implement the per-kind branching - and drift apart doing it.

// Topmost placed part under a canvas point, optionally limited to the parts `accept` allows.
// Searches in reverse draw order (redrawCanvas paints ICs, then standard, then advanced
// components, each in array order), so a click lands on the part that's visibly on top.
export function findPartAt(x: number, y: number, accept?: (part: IDragTarget) => boolean): IDragTarget | undefined {
  const candidates: IDragTarget[] = [];
  const advanced = AdvancedComponentState.placedComponents;
  for (let i = advanced.length - 1; i >= 0; i--) {
    if (advanced[i].containsPoint(x, y)) candidates.push({kind: "advanced-component", component: advanced[i]});
  }
  const standard = StandardComponentState.placedComponents;
  for (let i = standard.length - 1; i >= 0; i--) {
    if (standard[i].containsPoint(x, y)) candidates.push({kind: "standard-component", component: standard[i]});
  }
  const ics = IcState.placedIcs;
  for (let i = ics.length - 1; i >= 0; i--) {
    if (ics[i].containsPoint(x, y)) candidates.push({kind: "ic", ic: ics[i]});
  }
  return accept ? candidates.find(accept) : candidates[0];
}

export function getSelectedPart(): IDragTarget | undefined {
  if (IcState.selectedPlacedIc) return {kind: "ic", ic: IcState.selectedPlacedIc};
  if (StandardComponentState.selectedPlacedComponent) {
    return {kind: "standard-component", component: StandardComponentState.selectedPlacedComponent};
  }
  if (AdvancedComponentState.selectedPlacedComponent) {
    return {kind: "advanced-component", component: AdvancedComponentState.selectedPlacedComponent};
  }
  return undefined;
}

export function clearPartSelection() {
  IcState.selectedPlacedIc = undefined;
  StandardComponentState.selectedPlacedComponent = undefined;
  AdvancedComponentState.selectedPlacedComponent = undefined;
}

// Makes `part` the only selected part.
export function selectPart(part: IDragTarget) {
  clearPartSelection();
  if (part.kind === "ic") {
    IcState.selectedPlacedIc = part.ic;
  } else if (part.kind === "standard-component") {
    StandardComponentState.selectedPlacedComponent = part.component;
  } else {
    AdvancedComponentState.selectedPlacedComponent = part.component;
  }
}

// Takes a part off the board as one undoable step. Returns false if it wasn't on the board.
export function removePart(part: IDragTarget): boolean {
  let change: IChange;
  let index: number;
  if (part.kind === "ic") {
    index = IcState.placedIcs.indexOf(part.ic);
    if (index > -1) IcState.placedIcs.splice(index, 1);
    if (IcState.selectedPlacedIc === part.ic) IcState.selectedPlacedIc = undefined;
    change = {type: "remove", kind: "ic", ic: part.ic};
  } else if (part.kind === "standard-component") {
    index = StandardComponentState.placedComponents.indexOf(part.component);
    if (index > -1) StandardComponentState.placedComponents.splice(index, 1);
    if (StandardComponentState.selectedPlacedComponent === part.component) {
      StandardComponentState.selectedPlacedComponent = undefined;
    }
    change = {type: "remove", kind: "standard-component", component: part.component};
  } else {
    index = AdvancedComponentState.placedComponents.indexOf(part.component);
    if (index > -1) AdvancedComponentState.placedComponents.splice(index, 1);
    if (AdvancedComponentState.selectedPlacedComponent === part.component) {
      AdvancedComponentState.selectedPlacedComponent = undefined;
    }
    change = {type: "remove", kind: "advanced-component", component: part.component};
  }
  if (index < 0) return false;
  HistoryState.record(change);
  return true;
}
