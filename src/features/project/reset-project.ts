import {Utils} from "../../utils/utils";
import {LineState} from "../../state/LineState";
import {PartState} from "../../state/PartState";
import {createDotGrid, heightInput, widthInput} from "./resize-grid";
import {redrawCanvas} from "../draw-canvas";
import {resetForNewBoard} from "../reset-interaction";

// Clears the board back to an empty grid. The IC catalog (built-in and custom ICs) is left alone:
// it's not part of the board.
Utils.getSafeHtmlElement<HTMLButtonElement>('resetBtn').addEventListener('click', function() {
  resetForNewBoard();
  LineState.lines = [];
  PartState.parts = [];
  localStorage.removeItem('save');
  createDotGrid(parseInt(widthInput.value || "10"), parseInt(heightInput.value || "10"));
  redrawCanvas()
});
