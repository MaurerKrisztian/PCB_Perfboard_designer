import {AdvancedComponentDefinition, getAdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {advancedPartShape, AdvancedPlacement, GridPoint} from "../../parts/part-geometry";
import {GRID_PITCH_PX, gridToPx} from "../../project-file/grid";
import {Point} from "../painter/painter";

// A fixed-pin part's shape (src/parts/part-geometry.ts) in drawing px, for the drawing and for the
// editor's placed parts (PlacedAdvancedComponent's pins and hit test), so they always agree.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AdvancedGeometry {
  def: AdvancedComponentDefinition;
  pins: Point[];
  // Holes the body covers that aren't pins, drawn dimmed.
  shaded: Point[];
  // The body's outline polygon; empty when the body is just the padded box around the pins.
  outline: Point[];
  // Where the icon (or its stand-in label) is centred.
  iconAnchor: Point;
  // Axis-aligned box around the visible body.
  bodyRect: Rect;
}

export function boundingRect(points: Point[], pad = 0): Rect {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
  return {x: minX, y: minY, w: maxX - minX, h: maxY - minY};
}

const toPx = (p: GridPoint): Point => ({x: gridToPx(p.x), y: gridToPx(p.y)});

// Undefined for a part whose definition this build doesn't know.
export function advancedPartGeometry(part: AdvancedPlacement & {definitionId: string}): AdvancedGeometry | undefined {
  const def = getAdvancedComponentDefinition(part.definitionId);
  if (!def) return undefined;
  const shape = advancedPartShape(def, part);
  const {left, top, right, bottom} = shape.body;
  return {
    def,
    pins: shape.pins.map(toPx),
    shaded: shape.covered.map(toPx),
    outline: shape.outline.map(toPx),
    iconAnchor: toPx(shape.iconAnchor),
    bodyRect: {x: gridToPx(left), y: gridToPx(top), w: (right - left) * GRID_PITCH_PX, h: (bottom - top) * GRID_PITCH_PX},
  };
}
