import {Utils} from "../../utils/utils";
import {State} from "../../state/State";
import {redrawCanvas} from "../draw-canvas";
import {Canvas} from "../../state/Canvas";
import {IProjectSave} from "../../interfaces/project-save.interface";
import {Ic} from "../ic";
import {unserialize} from "../../utils/serialization";

const loadInput = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectBtn');
const loadTrigger = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectTrigger');

loadTrigger.addEventListener('click', function() {
  loadInput.click();
});

loadInput.addEventListener('change', function(e) {
  // @ts-ignore
  const file = e.target.files[0];

  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const contents = e.target.result;
    const data = JSON.parse(contents) as IProjectSave;

    // Load the state of the canvas from the uploaded file
    loadProject(data)

    // Redraw the canvas
    redrawCanvas();
  };
  reader.readAsText(file);
});

export function loadProject(project: IProjectSave){
  Canvas.c.width = project.canvas.width
  Canvas.c.height = project.canvas.height
  State.dots = project.dots;
  State.lines = project.lines;
  Ic.IC_CONTAINER = project.ICs.map(ic => unserialize(ic, Ic));// unserialize(project.ICs, Ic);
  console.log(Ic.IC_CONTAINER)
  Ic.showICs()
}
