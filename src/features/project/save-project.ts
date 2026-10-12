import {DotState} from "../../state/DotState";
import {LineState} from "../../state/LineState";
import {PartState} from "../../state/PartState";
import {Utils} from "../../utils/utils";
import {Canvas} from "../../state/Canvas";
import {Ic} from "../ic";
import type {PlacedStandardComponent} from "../standard-components/placed-standard-component";
import type {PlacedAdvancedComponent} from "../advanced-components/placed-advanced-component";
import {PROJECT_FILE_VERSION, ProjectFile, SavedBoard, SavedPad, SavedWire} from "../../project-file/project-file";
import {holesAlong, toGridPos} from "../../project-file/grid";
import {DEFAULT_DOT_COLOR} from "../board-looks/board-look";
import {BoardState} from "../../state/BoardState";

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


// A stripboard lists its cuts. A perfboard has none to list: cuts made while the board was a
// stripboard stay on the dots, but they mean nothing on a perfboard, so they aren't saved.
function savedBoard(): SavedBoard {
  const cols = holesAlong(Canvas.gridWidth);
  const rows = holesAlong(Canvas.gridHeight);
  if (!BoardState.isStripboard) return {type: "perfboard", cols, rows};
  const cuts = DotState.dots.filter(dot => dot.cut).map(toGridPos);
  return {type: "stripboard", cols, rows, strips: BoardState.setup.strips, cuts};
}

// Marked holes only: a color other than the default, or a note.
function savedPads(): SavedPad[] {
  const pads: SavedPad[] = [];
  for (const dot of DotState.dots) {
    const color = dot.color && dot.color.toLowerCase() !== DEFAULT_DOT_COLOR ? dot.color : undefined;
    const note = dot.description?.trim() ? dot.description : undefined;
    if (color || note) pads.push({at: toGridPos(dot), ...(color ? {color} : {}), ...(note ? {note} : {})});
  }
  return pads;
}

function savedWires(): SavedWire[] {
  return LineState.lines.map(line => ({
    from: toGridPos(line.start),
    to: toGridPos(line.end),
    ...(line.color ? {color: line.color} : {}),
    ...(line.width ? {width: line.width} : {}),
  }));
}

// The file keeps one array per kind of part. PartState.parts is grouped by kind in the same
// order, so each array comes out in the order it was loaded and drawn.
export function getSaveJson(): ProjectFile {
  const parts = PartState.parts;
  return {
    version: PROJECT_FILE_VERSION,
    board: savedBoard(),
    pads: savedPads(),
    wires: savedWires(),
    placedIcs: parts.filter((p): p is Ic => p.kind === "ic").map(p => p.serialize()),
    placedStandardComponents: parts
      .filter((p): p is PlacedStandardComponent => p.kind === "standard-component").map(p => p.serialize()),
    placedAdvancedComponents: parts
      .filter((p): p is PlacedAdvancedComponent => p.kind === "advanced-component").map(p => p.serialize()),
    customIcs: Ic.customIcEntries(),
  };
}
