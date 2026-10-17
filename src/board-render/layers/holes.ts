import {GridPos, gridToPx} from "../../project-file/grid";
import {ProjectFile} from "../../project-file/project-file";
import {BoardView, isHovered, isSameItem} from "../board-view";
import {BoardLook, drawMarkedHole} from "../board-looks/board-look";
import {Painter, Point} from "../painter/painter";
import {DEFAULT_DOT_COLOR, PAD_RADIUS, SELECTION_COLOR} from "../palette";

// Every hole of the board: plain holes stamped, marked ones in their colour, then the rings that
// mark the selected, hovered or placement-start hole, then the notes written under holes. Holes
// under a chip's body (`hidden`) aren't drawn, since the chip sits on top of them; its pins are.

const START_RING_COLOR = "#22c55e";
const HOVER_RING_COLOR = "#e2e8f0";
const NOTE_FONT = {family: "sans", size: 10} as const;
// Notes show their first few letters, and all of it while the hole is hovered.
const NOTE_PREVIEW_LENGTH = 5;

const key = ([col, row]: GridPos) => `${col},${row}`;

export function drawHoles(painter: Painter, project: ProjectFile, look: BoardLook, hidden: Set<string>, view: BoardView) {
  const {cols, rows} = project.board;
  const pads = new Map(project.pads.map(pad => [key(pad.at), pad]));
  const marked = (color?: string) => color && color.toLowerCase() !== DEFAULT_DOT_COLOR ? color : undefined;

  const plain: Point[] = [];
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      if (hidden.has(key([col, row]))) continue;
      const color = marked(pads.get(key([col, row]))?.color);
      if (color) drawMarkedHole(painter, gridToPx(col), gridToPx(row), color);
      else plain.push({x: gridToPx(col), y: gridToPx(row)});
    }
  }
  painter.stamp(look.hole, plain);

  drawHoleRings(painter, view, cols, rows);

  for (const pad of project.pads) {
    if (!pad.note) continue;
    const hovered = isHovered(view, {kind: "hole", at: pad.at});
    const text = hovered ? pad.note : pad.note.substring(0, NOTE_PREVIEW_LENGTH);
    painter.text(text, gridToPx(pad.at[0]), gridToPx(pad.at[1]) + PAD_RADIUS + 11, {
      font: NOTE_FONT, color: pad.color || DEFAULT_DOT_COLOR, align: "center",
    });
  }
}

// One ring per hole at most: selected wins over a placement's start, which wins over hover.
function drawHoleRings(painter: Painter, view: BoardView, cols: number, rows: number) {
  const onBoard = ([col, row]: GridPos) => col >= 0 && row >= 0 && col < cols && row < rows;
  const selected = view.selected?.kind === "hole" && onBoard(view.selected.at) ? view.selected.at : undefined;
  if (selected) {
    const x = gridToPx(selected[0]), y = gridToPx(selected[1]);
    painter.circle(x, y, PAD_RADIUS + 4, {stroke: {paint: SELECTION_COLOR, width: 3}});
    painter.circle(x, y, PAD_RADIUS + 1, {stroke: {paint: "#ffffff", width: 1.5}});
  }
  const start = view.startHole && onBoard(view.startHole) && !isSameItem(view.selected, {kind: "hole", at: view.startHole})
    ? view.startHole : undefined;
  if (start) {
    painter.circle(gridToPx(start[0]), gridToPx(start[1]), PAD_RADIUS + 4, {stroke: {paint: START_RING_COLOR, width: 3}});
  }
  for (const item of view.hovered ?? []) {
    if (item.kind !== "hole" || !onBoard(item.at) || isSameItem(view.selected, item)) continue;
    if (start && start[0] === item.at[0] && start[1] === item.at[1]) continue;
    painter.circle(gridToPx(item.at[0]), gridToPx(item.at[1]), PAD_RADIUS + 3, {stroke: {paint: HOVER_RING_COLOR, width: 2}});
  }
}
