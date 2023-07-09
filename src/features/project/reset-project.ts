import {Utils} from "../../utils/utils";
import {State} from "../../state/State";
import {createDotGrid, heightInput, widthInput} from "./resize-grid";
import {resetCanvas} from "../reset-canvas";
import {redrawCanvas} from "../draw-canvas";
import {Ic} from "../ic";

Utils.getSafeHtmlElement<HTMLButtonElement>('resetBtn').addEventListener('click', function() {
  State.lines = [];
  State.dots = [];
  Ic.IC_CONTAINER = [];
  localStorage.setItem('save', undefined);
  createDotGrid(parseInt(widthInput.value || "10"), parseInt(heightInput.value || "10"));
  resetCanvas()
  redrawCanvas()
});
