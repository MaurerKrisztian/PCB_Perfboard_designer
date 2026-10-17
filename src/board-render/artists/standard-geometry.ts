import {ComponentDefinition, getComponentBodySize} from "../../parts/component-definitions";
import {Point} from "../painter/painter";

// Where a flexible-lead part's artwork is, in its own frame: rotated so the span runs along +x
// from its first lead (origin) to its second. Shared by the drawing and the editor's hit test
// (PlacedStandardComponent.containsPoint), so they always agree on where the part is.
//
// Icons are authored as square artwork (viewBox="0 0 100 100"), so the body is a fixed square
// whatever the hole-to-hole distance; only the leads stretch to fill the rest. Bodies are
// deliberately larger than one grid step, so on short spans they cover the holes they sit between
// and no lead is drawn at all.
export interface StandardPartSpan {
  length: number;
  angle: number;
  bodySize: number;
  bodyStart: number;
  bodyEnd: number;
}

export function standardPartSpan(from: Point, to: Point, def: ComponentDefinition): StandardPartSpan {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const bodySize = getComponentBodySize(def);
  const bodyStart = (length - bodySize) / 2;
  return {length, angle, bodySize, bodyStart, bodyEnd: bodyStart + bodySize};
}
