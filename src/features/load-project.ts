import {Utils} from "../utils/utils";
import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";

const loadInput = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectBtn');
const loadTrigger = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectTrigger');

loadTrigger.addEventListener('click', function() {
  loadInput.click();
});

loadInput.addEventListener('change', function(e) {
  var file = e.target.files[0];

  if (!file) return;

  var reader = new FileReader();
  reader.onload = function(e) {
    var contents = e.target.result;
    var data = JSON.parse(contents);

    // Load the state of the canvas from the uploaded file
    State.dots = data.dots;
    State.lines = data.lines;

    // Redraw the canvas
    redrawCanvas();
  };
  reader.readAsText(file);
});
