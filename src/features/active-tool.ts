import {ActiveTool, ToolState} from "../state/ToolState";
import {redrawCanvas} from "./draw-canvas";
import {updateSelectionStatus} from "./selection-status";

// Switches what a click on the board does: a toolbar mode, or a placement tool (replacing any
// other). The toolbar and catalog highlights follow (updateSelectionStatus keeps them in sync).
export function setActiveTool(tool: ActiveTool) {
  ToolState.active = tool;
  updateSelectionStatus();
  redrawCanvas();
}
