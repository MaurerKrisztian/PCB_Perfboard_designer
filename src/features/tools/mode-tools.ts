import {HistoryState} from "../../state/HistoryState";
import {LineState} from "../../state/LineState";
import {SelectionState} from "../../state/SelectionState";
import {ActiveTool} from "../../state/ToolState";
import {DEFAULT_DOT_COLOR} from "../../board-render";
import {selectAt, selectLine} from "../board-selection";
import {addDescriptionToDot} from "../dot-notes";
import {findPartAt, removePart} from "../placed-parts";
import {ToolBehavior} from "./tool";

// The toolbar's three modes.

const modeStatus = (tool: ActiveTool) => `Tool: ${tool.kind.toUpperCase()} Mode`;

// A press on bare board is held back by select.ts to tell a click from a drag-to-pan, so this
// only sees presses on a placed part (picking it up) - and the released click, via selectAt.
export const selectTool: ToolBehavior<Extract<ActiveTool, {kind: "select"}>> = {
  onPointerDown(_tool, {x, y}) {
    selectAt(x, y, true);
    return true;
  },
  statusText: modeStatus,
};

// Removes the topmost part under the pointer, else the wire, else the pad's color and note.
export const eraserTool: ToolBehavior<Extract<ActiveTool, {kind: "eraser"}>> = {
  onPointerDown(_tool, {x, y, hoverDot}) {
    const part = findPartAt(x, y);
    if (part) {
      removePart(part);
      return true;
    }
    selectLine(x, y);
    const line = SelectionState.line;
    const index = line ? LineState.lines.indexOf(line) : -1;
    if (line && index > -1) {
      HistoryState.record({type: 'remove', kind: 'line', line});
      LineState.lines.splice(index, 1);
      SelectionState.clear();
      return true;
    }
    if (hoverDot) {
      if (hoverDot.color && hoverDot.color !== DEFAULT_DOT_COLOR) hoverDot.color = DEFAULT_DOT_COLOR;
      if (hoverDot.description) hoverDot.description = undefined;
    }
    return true;
  },
  statusText: modeStatus,
};

export const noteTool: ToolBehavior<Extract<ActiveTool, {kind: "note"}>> = {
  onPointerDown(_tool, {hoverDot}) {
    if (hoverDot) addDescriptionToDot(hoverDot);
    return true;
  },
  statusText: modeStatus,
};
