// Colours and sizes used by more than one part of the board's drawing. Everything used in one
// place only stays next to the code that draws it.

// Drawing pixels; one hole pitch is GRID_PITCH_PX (50). The copper ring around a hole (a
// perfboard's pad, or a marked hole on either board) and the drilled hole itself. Selection and
// hover rings are sized from the pad.
export const PAD_RADIUS = 10.5;
export const HOLE_RADIUS = 6.3;

export const COPPER_COLOR = "#b7733b";
export const HOLE_COLOR = "#0a170b";

// The colour every hole starts with in the editor; any other colour means the user marked it.
export const DEFAULT_DOT_COLOR = "#a4a0a0";

// What's selected, and the edge of a selected part.
export const SELECTION_COLOR = "#38bdf8";

export const DEFAULT_WIRE_WIDTH = 4;
export const DEFAULT_WIRE_COLOR = "#777676";

// Light text with a dark halo, readable over the board, wires and bodies alike.
export const LABEL_COLOR = "#f8fafc";
export const LABEL_HALO = {color: "rgba(2,6,23,0.9)", width: 3};

// The see-through look of a part about to be placed (a tool's preview).
export const GHOST_OPACITY = 0.55;
export const GHOST_DASH = [6, 4];
