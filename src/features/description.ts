import {State} from "../state/State";
import {redrawCanvas} from "./draw-canvas";
import {Utils} from "../utils/utils";

// Add description
Utils.getSafeHtmlElement<HTMLButtonElement>('addDescriptionBtn').addEventListener('click', function() {
  if(State.selectedDot){
    const description = prompt("Enter a description for the dot");
    State.selectedDot.description = description;
    State.selectedDot = null;
    redrawCanvas();
  } else {
    alert("Please select a dot first by clicking on it");
  }
});

// Delete description
Utils.getSafeHtmlElement<HTMLButtonElement>('deleteDescriptionBtn').addEventListener('click', function() {
  if(State.selectedDot){
    State.selectedDot.description = null;
    redrawCanvas();
  } else {
    alert("Please select a dot first by clicking on it");
  }
});
