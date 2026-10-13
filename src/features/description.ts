import {redrawCanvas} from "./draw-canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {SelectionState} from "../state/SelectionState";
import {addDescriptionToDot} from "./dot-notes";

function removeDescriptionFromDot(){
  if(SelectionState.dot){
    SelectionState.dot.description = null;
    redrawCanvas();
  } else {
    alert("Please select a dot first by clicking on it");
  }
}

ShortcutRegistry.add({key: "d", event: () => {
  if (addDescriptionToDot()) redrawCanvas();
}, description: "Add description."})
ShortcutRegistry.add({key: "d", shift: true, event: removeDescriptionFromDot, description: "Remove description."})
