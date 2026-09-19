import {HistoryState} from "../../state/HistoryState";
import {LineState} from "../../state/LineState";
import {redrawCanvas} from "../draw-canvas";
import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";

Utils.getSafeHtmlElement<HTMLButtonElement>('backBtn').addEventListener('click', function() {
undo();
});
export function undo(){
  if(HistoryState.changeIndex >= 0){
    const change = HistoryState.changes[HistoryState.changeIndex];
    if(change.type == 'add'){
      for(let i = 0; i < LineState.lines.length; i++) {
        if(LineState.lines[i].start == change.line.start && LineState.lines[i].end == change.line.end){
          LineState.lines.splice(i, 1);
          break;
        }
      }
    } else if(change.type == 'remove'){
      LineState.lines.push(change.line);
    }
    HistoryState.changeIndex--;
    redrawCanvas();
  }
}

// Forward button
Utils.getSafeHtmlElement<HTMLButtonElement>('forwardBtn').addEventListener('click', function() {
  redo()
});

export function redo(){
  if(HistoryState.changeIndex < HistoryState.changes.length - 1){
    HistoryState.changeIndex++;
    const change = HistoryState.changes[HistoryState.changeIndex];
    if (change == undefined){
      return;
    }
    if(change.type == 'add'){
      LineState.lines.push(change.line);
    } else if(change.type == 'remove'){
      for(let i = 0; i < LineState.lines.length; i++) {
        if(LineState.lines[i].start == change.line.start && LineState.lines[i].end == change.line.end){
          LineState.lines.splice(i, 1);
          break;
        }
      }
    }
    redrawCanvas();
  }
}

ShortcutRegistry.add({key: "z", ctrl: true, description: "Undo last change.", event: undo});
ShortcutRegistry.add({key: "y", ctrl: true, description: "Redo last undo.", event: redo});
