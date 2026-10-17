// How the board renderer puts shapes on a surface, and nothing about boards. Two painters
// implement it: CanvasPainter (src/features/board-canvas/: the editor's canvas, PNG export and
// thumbnails) and SvgPainter (svg-painter.ts: an SVG document, for the MCP server and SVG export).
//
// Coordinates are drawing pixels: the board's top-left corner is (0, 0) and one hole pitch is
// GRID_PITCH_PX (50). Every call carries its whole style, so nothing carries over from one shape to
// the next; transforms, opacity and clipping only ever apply inside group().

export interface Point {
  x: number;
  y: number;
}

// SVG path syntax ("M 0 0 L 10 0 A 5 5 0 0 1 ..."); the canvas painter reads it with Path2D.
export type PathData = string;

// Coordinates are in the space the shape is drawn in (inside any group's transform).
export interface LinearGradient {
  kind: "linear";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: {offset: number; color: string}[];
}

export type Paint = string | LinearGradient;

export interface Stroke {
  paint: Paint;
  width: number;
  cap?: "butt" | "round";
  join?: "miter" | "round";
  dash?: number[];
}

export interface ShapeStyle {
  fill?: Paint;
  stroke?: Stroke;
}

// "mono" for pin numbers, refs and chip names, "sans" for everything else.
export type FontFamily = "mono" | "sans";

export interface Font {
  family: FontFamily;
  size: number;
  weight?: number;
}

export interface TextStyle {
  font: Font;
  color: string;
  align?: "left" | "center" | "right";
  // Where y is: the text's middle, or its baseline (the default).
  baseline?: "middle" | "alphabetic";
  // A stroke drawn under the text, so it stays readable over anything.
  halo?: {color: string; width: number};
  // Text wider than this is squeezed to fit.
  maxWidth?: number;
}

// Applied in this order: translate, rotate (radians, clockwise), scale. The clip path is in the
// group's own (transformed) coordinates.
export interface GroupOptions {
  translate?: [number, number];
  rotate?: number;
  scale?: number;
  opacity?: number;
  clip?: PathData;
}

// A small drawing repeated at many points, like the board's holes: drawn once and copied, as a
// sprite on a canvas and as a <symbol> in SVG. `draw` paints it centred on (0, 0), within `radius`.
export interface Stamp {
  id: string;
  radius: number;
  draw(painter: Painter): void;
}

export interface IconSize {
  width: number;
  height: number;
}

export interface Painter {
  circle(cx: number, cy: number, r: number, style: ShapeStyle): void;
  // A half circle, or any other arc: from `start` to `end` (radians, clockwise from +x), closed by
  // a straight edge.
  arc(cx: number, cy: number, r: number, start: number, end: number, style: ShapeStyle): void;
  rect(x: number, y: number, w: number, h: number, style: ShapeStyle, cornerRadius?: number): void;
  // An open line through the points.
  line(points: Point[], stroke: Stroke): void;
  polygon(points: Point[], style: ShapeStyle): void;
  path(d: PathData, style: ShapeStyle): void;
  text(text: string, x: number, y: number, style: TextStyle): void;
  measureText(text: string, font: Font): number;
  // Part artwork, by icon file name ("resistor.svg"). Undefined (and image() false) while an icon
  // isn't available, e.g. still loading in the browser, so the caller draws a stand-in instead.
  iconSize(icon: string): IconSize | undefined;
  // Stretched to fill the box, like the canvas's drawImage.
  image(icon: string, x: number, y: number, w: number, h: number): boolean;
  group(options: GroupOptions, draw: () => void): void;
  stamp(stamp: Stamp, points: Point[]): void;
}
