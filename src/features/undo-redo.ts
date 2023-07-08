import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";

Utils.getSafeHtmlElement<HTMLButtonElement>('backBtn').addEventListener('click', function() {
  if(State.changeIndex >= 0){
    const change = State.changes[State.changeIndex];
    if(change.type == 'add'){
      for(let i = 0; i < State.lines.length; i++) {
        if(State.lines[i].start == change.line.start && State.lines[i].end == change.line.end){
          State.lines.splice(i, 1);
          break;
        }
      }
    } else if(change.type == 'remove'){
      State.lines.push(change.line);
    }
    State.changeIndex--;
    redrawCanvas();
  }
});

// Forward button
Utils.getSafeHtmlElement<HTMLButtonElement>('forwardBtn').addEventListener('click', function() {
  if(State.changeIndex < State.changes.length - 1){
    State.changeIndex++;
    const change = State.changes[State.changeIndex];
    if (change == undefined){
      return;
    }
    if(change.type == 'add'){
      State.lines.push(change.line);
    } else if(change.type == 'remove'){
      for(let i = 0; i < State.lines.length; i++) {
        if(State.lines[i].start == change.line.start && State.lines[i].end == change.line.end){
          State.lines.splice(i, 1);
          break;
        }
      }
    }
    redrawCanvas();
  }
});
