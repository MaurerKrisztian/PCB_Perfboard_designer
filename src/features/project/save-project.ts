import {State} from "../../state/State";
import {Utils} from "../../utils/utils";
import {Canvas} from "../../state/Canvas";
import {IProjectSave} from "../../interfaces/project-save.interface";
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


export function getSaveJson(): IProjectSave{
  return {dots: State.dots, lines: State.lines, canvas: { width: Canvas.c.width, height: Canvas.c.height}, ICs: Ic.IC_CONTAINER || []}
}
