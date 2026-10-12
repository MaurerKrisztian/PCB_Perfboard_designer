import {IDot} from "../interfaces/dot.interface";
import {DotState} from "../state/DotState";
import {SelectionState} from "../state/SelectionState";

// Asks for a pad's note and stores it. Returns whether anything changed; the caller redraws.
// Kept free of draw-canvas so the note tool, which draw-canvas reaches through the tool
// registry, doesn't close an import cycle.
export function addDescriptionToDot(targetDot?: IDot): boolean {
  const dot = targetDot || SelectionState.dot || DotState.hoverDot;
  if (!dot) {
    alert("Please click on a pad first to add a note.");
    return false;
  }
  const current = dot.description || "";
  const description = prompt("Enter a note / annotation for this pad:", current);
  if (description === null) return false;
  dot.description = description.trim() ? description.trim() : undefined;
  SelectionState.clear("dot");
  return true;
}
