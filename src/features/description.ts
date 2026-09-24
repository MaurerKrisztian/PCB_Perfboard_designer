import {DotState} from "../state/DotState";
import {redrawCanvas} from "./draw-canvas";
import {ShortcutRegistry} from "./shortcut-keys";

export function addDescriptionToDot(targetDot?: any){
  const dot = targetDot || DotState.selectedDot || DotState.hoverDot;
  if(dot){
    const current = dot.description || "";
    const description = prompt("Enter a note / annotation for this pad:", current);
    if (description !== null) {
      dot.description = description.trim() ? description.trim() : undefined;
      DotState.selectedDot = undefined;
      redrawCanvas();
    }
  } else {
    alert("Please click on a pad first to add a note.");
  }
}

function removeDescriptionFromDot(){
  if(DotState.selectedDot){
    DotState.selectedDot.description = null;
    redrawCanvas();
  } else {
    alert("Please select a dot first by clicking on it");
  }
}



ShortcutRegistry.add({key: "d", event: addDescriptionToDot, description: "Add description."})
ShortcutRegistry.add({key: "D", event: removeDescriptionFromDot, description: "Remove description."})
