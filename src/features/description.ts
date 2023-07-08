import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";
import {ShortcutRegistry} from "./shortcut-keys";
// Add description
Utils.getSafeHtmlElement<HTMLButtonElement>('addDescriptionBtn').addEventListener('click', function() {
  addDescriptionToDot();
});

// Delete description
Utils.getSafeHtmlElement<HTMLButtonElement>('deleteDescriptionBtn').addEventListener('click', function() {
  removeDescriptionFromDot();
});

function addDescriptionToDot(){
  if(State.selectedDot){
    const description = prompt("Enter a description for the dot");
    State.selectedDot.description = description;
    State.selectedDot = undefined;
    redrawCanvas();
  } else {
    alert("Please select a dot first by clicking on it");
  }
}

function removeDescriptionFromDot(){
  if(State.selectedDot){
    State.selectedDot.description = null;
    redrawCanvas();
  } else {
    alert("Please select a dot first by clicking on it");
  }
}



ShortcutRegistry.add({key: "d", event: addDescriptionToDot, description: "Add description."})
ShortcutRegistry.add({key: "D", event: removeDescriptionFromDot, description: "Remove description."})
