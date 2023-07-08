import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Canvas} from "../state/Canvas";
Canvas.c.addEventListener('mousedown', function(e) {
  setSelection(Canvas.c, e);
})
function setSelection(canvas, event) {
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Check if click is within a dot
  for(let i = 0; i < State.dots.length; i++) {
    var dot = State.dots[i];
    var dx = x - dot.x;
    var dy = y - dot.y;
    if(dx * dx + dy * dy < State.dotRadius * State.dotRadius){
      if(State.selectedDot && State.selectedDot != dot){
        // Draw a line
        var newLine = {start: State.selectedDot, end: dot, color: "#777676"};
        State.lines.push(newLine);
        // Store change
        State.changes.splice(State.changeIndex + 1);
        State.changes.push({type: 'add', line: newLine});
        State.changeIndex++;
        // Reset selection
        State.selectedDot = null;
        State.selectedLine = newLine;
        redrawCanvas();
      } else {
        // Select this dot
        State.selectedDot = dot;
        State.selectedLine = null;
        redrawCanvas();
      }
      return;
    }
  }

// Check if click is within a line
  for(let i = 0; i < State.lines.length; i++) {
    var line = State.lines[i];
    var dx1 = line.start.x - x;
    var dy1 = line.start.y - y;
    var dx2 = line.end.x - x;
    var dy2 = line.end.y - y;
    var d1 = Math.sqrt(dx1*dx1 + dy1*dy1); // distance from start dot to point
    var d2 = Math.sqrt(dx2*dx2 + dy2*dy2); // distance from end dot to point
    var d = Math.sqrt(Math.pow(line.end.x-line.start.x, 2) + Math.pow(line.end.y-line.start.y, 2)); // distance from start dot to end dot
    if (Math.abs(d - (d1 + d2)) < 5) {
      State.selectedLine = line;
      State.selectedDot = null;
      redrawCanvas();
      return;
    }
  }


  // Click is in empty space, reset selection
  State.selectedDot = null;
  State.selectedLine = null;
  redrawCanvas();
}
