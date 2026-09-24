import {IDot} from "../interfaces/dot.interface";
import {IDragTarget} from "../interfaces/drag-target.interface";

export class DragState {
  // The part currently being dragged; undefined means no drag is in progress.
  static target?: IDragTarget;
  // Dot nearest the cursor as of the last committed step. The part translates by the delta
  // between this and the dot nearest the cursor now, which is what keeps the grab offset.
  static grabDot?: IDot;
  // Anchor dots as they were when the drag started, for the history entry and for cancelling.
  static originDots?: IDot[];
  // Position -> dot index of the grid, built once per drag since dots can't change mid-drag.
  static dotIndex?: Map<string, IDot>;
  static moved = false;
}
