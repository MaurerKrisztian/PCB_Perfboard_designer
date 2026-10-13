import {Utils} from "../../utils/utils";
import {LineState} from "../../state/LineState";
import {PartState} from "../../state/PartState";
import type {Part} from "../../interfaces/placed-part.interface";
import {IDot} from "../../interfaces/dot.interface";
import {redrawCanvas} from "../draw-canvas";
import {Ic} from "../ic";
import {PlacedStandardComponent} from "../standard-components/placed-standard-component";
import {PlacedAdvancedComponent} from "../advanced-components/placed-advanced-component";
import {resetForNewBoard} from "../reset-interaction";
import {createDotGrid, heightInput, widthInput} from "./resize-grid";
import {buildDotIndex, dotPositionKey} from "../dot-lookup";
import {GridPos, gridToPx} from "../../project-file/grid";
import {ProjectFileError, readProjectFile} from "../../project-file/read-project-file";
import {setBoardSetup} from "../board-type";

const loadInput = Utils.getSafeHtmlElement<HTMLInputElement>('loadProjectBtn');
const loadTrigger = Utils.getSafeHtmlElement<HTMLButtonElement>('loadProjectTrigger');

loadTrigger.addEventListener('click', function() {
  loadInput.click();
});

loadInput.addEventListener('change', function() {
  const file = loadInput.files?.[0];
  // Clear the input so picking the same file again still fires 'change'.
  loadInput.value = '';

  if (!file) return;

  const reader = new FileReader();
  reader.onload = function() {
    let skipped: number;
    try {
      ({skipped} = loadProject(JSON.parse(String(reader.result))));
    } catch (err) {
      console.error(err);
      const reason = err instanceof ProjectFileError ? err.message : "It isn't a valid project file.";
      alert(`Couldn't open "${file.name}". ${reason}`);
      return;
    }
    if (skipped > 0) {
      alert(`Opened "${file.name}", but ${skipped} item${skipped === 1 ? "" : "s"} couldn't be read and ${skipped === 1 ? "was" : "were"} left out.`);
    }
  };
  reader.readAsText(file);
});

// Replaces the board with a project file's (any version). The file is read and checked in full
// first, so a file that isn't a project throws ProjectFileError with the board untouched.
// Returns how many malformed or off-board entries were left out.
export function loadProject(raw: unknown): {skipped: number} {
  const {project, skipped} = readProjectFile(raw);

  resetForNewBoard();
  const {board} = project;
  widthInput.value = String(board.cols);
  heightInput.value = String(board.rows);
  setBoardSetup({type: board.type, strips: board.type === "stripboard" ? board.strips : "horizontal"});
  createDotGrid(board.cols, board.rows);

  // The reader only lets through positions on the board, so every lookup finds its dot. Wires and
  // parts are pinned to these shared dot objects, as when they're placed by hand.
  const dots = buildDotIndex();
  const dotAt = ([col, row]: GridPos): IDot => dots.get(dotPositionKey(gridToPx(col), gridToPx(row))) as IDot;

  for (const pad of project.pads) {
    const dot = dotAt(pad.at);
    if (pad.color) dot.color = pad.color;
    if (pad.note) dot.description = pad.note;
  }
  if (board.type === "stripboard") {
    for (const at of board.cuts) dotAt(at).cut = true;
  }

  LineState.lines = project.wires.map(wire => ({start: dotAt(wire.from), end: dotAt(wire.to), color: wire.color, width: wire.width}));

  const parts: Part[] = [];
  for (const saved of project.placedIcs) {
    const ic = new Ic(saved.widthPin, saved.heightPin, {...saved.pinDescription}, saved.name);
    ic.ref = saved.ref;
    ic.rotationAngle = saved.rotation;
    ic.topLeftDot = dotAt(saved.at);
    parts.push(ic);
  }
  for (const saved of project.placedStandardComponents) {
    const component = new PlacedStandardComponent(saved.definitionId, dotAt(saved.from), dotAt(saved.to));
    component.ref = saved.ref;
    component.value = saved.value;
    component.color = saved.color;
    parts.push(component);
  }
  for (const saved of project.placedAdvancedComponents) {
    const component = new PlacedAdvancedComponent(saved.definitionId, dotAt(saved.at), saved.rotation);
    component.ref = saved.ref;
    component.rows = saved.rows;
    component.cols = saved.cols;
    component.value = saved.value;
    parts.push(component);
  }
  // Kind by kind, in the grouped order PartState.parts keeps.
  PartState.parts = parts;

  // A file's custom ICs join the catalog (and are kept, like ones made here) rather than replacing it.
  if (Ic.addCustomIcs(project.customIcs) > 0) Ic.saveCustomIcsToLocalStorage();

  redrawCanvas();
  return {skipped};
}
