import {Utils} from "../utils/utils";
import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";

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
    const data = JSON.parse(contents);

    // Load the state of the canvas from the uploaded file
    State.dots = data.dots;
    State.lines = data.lines;

    // Redraw the canvas
    redrawCanvas();
  };
  reader.readAsText(file);
});
