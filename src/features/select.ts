import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Canvas} from "../state/Canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {ILine} from "../interfaces/line.interface";
Canvas.c.addEventListener('mousedown', function(e) {
  setSelection(e);
  if (State.selectedIc){
    State.selectedIc = undefined;
  }
})

function addNewLineIfNeeded(){
    if (!State.hoverDot){
      return;
    }
    if(State.selectedDot && State.selectedDot != State.hoverDot){
      const newLine: ILine = {start: State.selectedDot, end: State.hoverDot, color: "#777676"};
      State.lines.push(newLine);
      State.changes.splice(State.changeIndex + 1);
      State.changes.push({type: 'add', line: newLine});
      State.changeIndex++;

      // Reset selection
      State.selectedDot = undefined;
      State.selectedLine = newLine;
      redrawCanvas();
    }
}

function selectDot(){
  if (!State.hoverDot){
    return;
  }
  State.selectedDot = State.hoverDot;
  State.selectedLine = undefined;
  redrawCanvas();
}
// This function is used to select a line on a canvas based on the user's mouse click event
export function selectLine(event) {
  // Check if there is a hoverDot, if so, return early and do not select any lines
  if (State.hoverDot) {
    return;
  }

  // Get the bounding rectangle of the canvas
  const rect = Canvas.c.getBoundingClientRect();

  // Calculate the relative coordinates of the mouse click event within the canvas
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Iterate over each line in the State.lines array
  for (let i = 0; i < State.lines.length; i++) {
    const line = State.lines[i];

    // Calculate the differences between the line's start and end points and the mouse click coordinates
    const dx1 = line.start.x - x;
    const dy1 = line.start.y - y;
    const dx2 = line.end.x - x;
    const dy2 = line.end.y - y;

    // Calculate the distances from the start and end points of the line to the mouse click coordinates
    const d1 = Math.sqrt(dx1 * dx1 + dy1 * dy1); // distance from start dot to point
    const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2); // distance from end dot to point

    // Calculate the distance between the start and end points of the line
    const d = Math.sqrt(
      Math.pow(line.end.x - line.start.x, 2) + Math.pow(line.end.y - line.start.y, 2)
    );

    // Check if the mouse click is within a certain tolerance distance from the line
    if (Math.abs(d - (d1 + d2)) < State.lineSelectTolerance) {
      // Line is selected
      State.selectedLine = line;
      State.selectedDot = undefined;

      // Redraw the canvas
      redrawCanvas();

      // Exit the function after selecting the line
      return;
    }
  }

  // Click is in empty space, reset selection
  State.selectedDot = undefined;
  State.selectedLine = undefined;

  // Redraw the canvas
  redrawCanvas();
}

function setSelection(event) {
  addNewLineIfNeeded()
  selectDot()
  selectLine(event);
}



ShortcutRegistry.add({key: "Escape", description: "Unselect dot or line", event: ()=>{
  State.selectedDot = undefined;
  State.selectedLine = undefined;
  State.selectedIc = undefined;
}});
