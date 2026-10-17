import type {BoardItem, BoardView} from "../../board-render";
import {toGridPos} from "../../project-file/grid";
import {DotState} from "../../state/DotState";
import {LineState} from "../../state/LineState";
import {NetHighlightState} from "../../state/NetHighlightState";
import {SelectionState} from "../../state/SelectionState";
import {ToolState} from "../../state/ToolState";
import {ViewState} from "../../state/ViewState";

// What the editor marks on the board, for the board renderer: the selection, what's under the
// pointer, a placement's first click, the net picked in the Nets panel, and whether part labels
// are on. Items are named as the project file knows them (a part by ref, a wire by its index,
// a hole by its position), since that's what the renderer draws from.

function selectedItem(): BoardItem | undefined {
  const selection = SelectionState.current;
  if (!selection) return undefined;
  if (selection.kind === "part") return {kind: "part", ref: selection.part.ref};
  if (selection.kind === "dot") return {kind: "hole", at: toGridPos(selection.dot)};
  const index = LineState.lines.indexOf(selection.line);
  return index >= 0 ? {kind: "wire", index} : undefined;
}

function hoveredItems(): BoardItem[] {
  const items: BoardItem[] = [];
  if (DotState.hoverDot) items.push({kind: "hole", at: toGridPos(DotState.hoverDot)});
  const line = LineState.hoverLine ? LineState.lines.indexOf(LineState.hoverLine) : -1;
  if (line >= 0) items.push({kind: "wire", index: line});
  return items;
}

export function editorView(): BoardView {
  const start = ToolState.pendingStart;
  const net = NetHighlightState.current;
  return {
    partLabels: ViewState.showPartLabels,
    selected: selectedItem(),
    hovered: hoveredItems(),
    ...(start ? {startHole: toGridPos(start)} : {}),
    ...(net ? {highlight: {holes: net.holes, wires: net.wires}} : {}),
  };
}
