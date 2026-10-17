import {SavedAdvancedComponent, SavedIc, SavedStandardComponent} from "../../project-file/project-file";
import {Painter, Point} from "../painter/painter";

// How each kind of placed part is drawn, from its entry in the project file. One artist per kind
// (ic-artist.ts, standard-artist.ts, advanced-artist.ts), registered in index.ts here: a new kind
// of part is a new artist and one line there. Parts of a known kind need no code at all, only a
// definition.

export type BoardPart =
  | {kind: "ic"; entry: SavedIc}
  | {kind: "standard-component"; entry: SavedStandardComponent}
  | {kind: "advanced-component"; entry: SavedAdvancedComponent};

export interface PartLook {
  selected?: boolean;
  // A tool's preview of where the part would go: see-through.
  ghost?: boolean;
  // Print the ref on the part, for parts that carry their own name (chips).
  showRef?: boolean;
}

// Where a part's label (ref and value, "R1 10kΩ") goes. Beside it: the top-left corner of the
// label's box for each spot to try, given the box's size, best first; the first spot that keeps
// the label on the board wins. On its body: centred on a point, turned to read bottom to top
// when `vertical`.
export type LabelSpot = (w: number, h: number) => Point;
export type PartLabel =
  | {text: string; spots: LabelSpot[]}
  | {text: string; at: Point; vertical: boolean};

export interface PartArtist<Entry> {
  // Chips lie flat under the board's holes and wires; everything else stands above the wires.
  layer: "under-board" | "over-wires";
  draw(painter: Painter, entry: Entry, look: PartLook): void;
  // Drawn after every part and label, on top of everything (a chip's pin numbers).
  drawOverlay?(painter: Painter, entry: Entry, look: PartLook): void;
  // Absent for parts that print their own name (chips).
  label?(entry: Entry): PartLabel | undefined;
}

// What a label says: the ref and value, or undefined when there's neither.
export function labelText(ref: string, value?: string): string | undefined {
  const text = [ref, value?.trim()].filter(Boolean).join(" ");
  return text || undefined;
}
