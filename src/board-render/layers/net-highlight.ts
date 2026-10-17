import {gridToPx} from "../../project-file/grid";
import {BoardView} from "../board-view";
import {Painter} from "../painter/painter";
import {DEFAULT_WIRE_WIDTH, PAD_RADIUS} from "../palette";

// A net lit up (the one picked in the editor's Nets panel): a glow along its wires and a ring on
// every hole, drawn over everything so it shows through parts sitting on it.

// Same as --net-highlight in style.css, which marks the picked net in the panel.
const NET_HIGHLIGHT_COLOR = "#e879f9";

export function drawNetHighlight(painter: Painter, highlight: NonNullable<BoardView["highlight"]>) {
  painter.group({opacity: 0.55}, () => {
    for (const wire of highlight.wires) {
      painter.line(
        [{x: gridToPx(wire.from[0]), y: gridToPx(wire.from[1])}, {x: gridToPx(wire.to[0]), y: gridToPx(wire.to[1])}],
        {paint: NET_HIGHLIGHT_COLOR, width: (wire.width || DEFAULT_WIRE_WIDTH) + 8, cap: "round"},
      );
    }
  });
  for (const [col, row] of highlight.holes) {
    painter.circle(gridToPx(col), gridToPx(row), PAD_RADIUS + 6, {stroke: {paint: NET_HIGHLIGHT_COLOR, width: 3}});
  }
}
