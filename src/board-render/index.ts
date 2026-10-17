// The board renderer: draws a board from its project file, onto any Painter. Pure like
// src/project-file/ (no DOM, no editor state), so the editor, exports, thumbnails and the MCP
// server all draw boards the same way. This file is its whole public face: code outside
// src/board-render/ imports from here only. ARCHITECTURE.md ("Rendering") explains the design.

export {drawBoard, boardSizePx} from "./draw-board";
export {renderBoardSvg, type SvgRenderOptions} from "./render-svg";
export {type BoardItem, type BoardView, PLAIN_VIEW} from "./board-view";

// Painting surfaces.
export type {
  Font, GroupOptions, IconSize, LinearGradient, Paint, Painter, PathData, Point, ShapeStyle, Stamp, Stroke, TextStyle,
} from "./painter/painter";
export {SvgPainter, type SvgIcons, type SvgPainterOptions} from "./painter/svg-painter";
export {cssFont} from "./painter/fonts";

// Single parts, for the editor's placement previews.
export {drawPart, iconsUsedBy} from "./artists";
export type {BoardPart, PartLook} from "./artists/part-artist";

// Geometry the editor's hit tests share with the drawing, so clicking and drawing agree.
export {standardPartSpan, type StandardPartSpan} from "./artists/standard-geometry";
export {advancedPartGeometry, type AdvancedGeometry, type Rect} from "./artists/advanced-geometry";
// How far a chip's package reaches past its pins.
export {DIP_OVERHANG} from "./artists/ic-package/dip-shape";
export {MODULE_EDGE, MODULE_END} from "./artists/ic-package/module-shape";

// Catalog artwork for chips and dev boards.
export {dipIconSvg} from "./artists/ic-package/dip-shape";
export {moduleIconSvg} from "./artists/ic-package/module-shape";

// Colours the editor needs too.
export {DEFAULT_DOT_COLOR, SELECTION_COLOR} from "./palette";
export {PERFBOARD_COLOR} from "./board-looks/perfboard-look";
export {STRIPBOARD_COLOR} from "./board-looks/stripboard-look";
