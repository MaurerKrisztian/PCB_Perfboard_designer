import {Utils} from "../../utils/utils";
import {LineState} from "../../state/LineState";
import {DotState} from "../../state/DotState";
import {createDotGrid, heightInput, widthInput} from "./resize-grid";
import {resetCanvas} from "../reset-canvas";
import {redrawCanvas} from "../draw-canvas";
import {Ic} from "../ic";

Utils.getSafeHtmlElement<HTMLButtonElement>('resetBtn').addEventListener('click', function() {
  LineState.lines = [];
  DotState.dots = [];
  Ic.IC_CONTAINER = []; // todo ic menu disappears because of it
  localStorage.setItem('save', undefined);
  createDotGrid(parseInt(widthInput.value || "10"), parseInt(heightInput.value || "10"));
  resetCanvas()
  redrawCanvas()
});
