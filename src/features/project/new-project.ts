import {Utils} from "../../utils/utils";
import {LineState} from "../../state/LineState";
import {PartState} from "../../state/PartState";
import {createDotGrid, heightInput, widthInput} from "./resize-grid";
import {redrawCanvas} from "../draw-canvas";
import {resetForNewBoard} from "../reset-interaction";

// Clears the board back to an empty grid, after asking. The IC catalog (built-in and custom ICs)
// is left alone: it's not part of the board.
Utils.getSafeHtmlElement<HTMLButtonElement>('newProjectBtn').addEventListener('click', function() {
  if (!confirm('Start a new project? The current board will be cleared, including your browser save. This cannot be undone.')) return;
  resetForNewBoard();
  LineState.lines = [];
  PartState.parts = [];
  createDotGrid(parseInt(widthInput.value || "10"), parseInt(heightInput.value || "10"));
  redrawCanvas()
});
