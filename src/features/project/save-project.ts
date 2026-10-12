import {DotState} from "../../state/DotState";
import {LineState} from "../../state/LineState";
import {PartState} from "../../state/PartState";
import {Utils} from "../../utils/utils";
import {Canvas} from "../../state/Canvas";
import {IProjectSave} from "../../interfaces/project-save.interface";
import type {Part} from "../../interfaces/placed-part.interface";
import {Ic} from "../ic";

const saveBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('saveProjectBtn');
saveBtn.addEventListener('click', function() {
  // Convert the state of the canvas to a string (in JSON format)
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(getSaveJson()));

  // Create a download link and click it
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "canvas_project.json");
  document.body.appendChild(downloadAnchorNode); // required for firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});


// The file keeps one array per kind of part. PartState.parts is grouped by kind in the same
// order, so each array comes out in the order it was loaded and drawn.
function serializeParts(kind: Part["kind"]) {
  return PartState.parts.filter(part => part.kind === kind).map(part => part.serialize());
}

export function getSaveJson(): IProjectSave {
  return {
    dots: DotState.dots,
    lines: LineState.lines,
    canvas: { width: Canvas.gridWidth, height: Canvas.gridHeight },
    ICs: Ic.IC_CONTAINER || [],
    placedIcs: serializeParts("ic"),
    placedStandardComponents: serializeParts("standard-component"),
    placedAdvancedComponents: serializeParts("advanced-component")
  };
}
