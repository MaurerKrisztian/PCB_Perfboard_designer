// A stripboard's copper, in hole pitches. Shared by the editor and the 3D viewer so both draw
// strips and cuts the same way.

// About 2mm of copper on the 2.54mm pitch, leaving a visible gap between neighboring strips.
export const STRIP_WIDTH_PITCH = 0.76;
// A cut is a gap across the strip, centered on the cut hole and a little wider than the strip
// is, so it clearly breaks it.
export const CUT_GAP_PITCH = 0.88;
