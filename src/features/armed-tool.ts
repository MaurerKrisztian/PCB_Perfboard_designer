import {ArmedTool, ToolState} from "../state/ToolState";
import {redrawCanvas} from "./draw-canvas";
import {updateSelectionStatus} from "./selection-status";

// Arms a placement tool, replacing whatever was armed before; with no argument, disarms. The
// toolbar and catalog highlights follow (updateSelectionStatus keeps them in sync).
export function arm(tool?: ArmedTool) {
  ToolState.armed = tool;
  updateSelectionStatus();
  redrawCanvas();
}
