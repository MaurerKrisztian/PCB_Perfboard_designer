import {DotState} from "../state/DotState";
import {redrawCanvas} from "./draw-canvas";
import {ShortcutRegistry} from "./shortcut-keys";
import {SelectionState} from "../state/SelectionState";

export function addDescriptionToDot(targetDot?: any){
  const dot = targetDot || SelectionState.dot || DotState.hoverDot;
  if(dot){
    const current = dot.description || "";
    const description = prompt("Enter a note / annotation for this pad:", current);
    if (description !== null) {
      dot.description = description.trim() ? description.trim() : undefined;
      SelectionState.clear("dot");
      redrawCanvas();
    }
  } else {
    alert("Please click on a pad first to add a note.");
  }
}

function removeDescriptionFromDot(){
  if(SelectionState.dot){
    SelectionState.dot.description = null;
    redrawCanvas();
  } else {
    alert("Please select a dot first by clicking on it");
  }
}



// Wrapped so the KeyboardEvent isn't passed through as the target dot.
ShortcutRegistry.add({key: "d", event: () => addDescriptionToDot(), description: "Add description."})
ShortcutRegistry.add({key: "d", shift: true, event: removeDescriptionFromDot, description: "Remove description."})
