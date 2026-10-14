import type {ProjectFile, SavedAdvancedComponent} from "../../project-file/project-file";
import type {GridPos} from "../../project-file/grid";
import {CUT_GAP_PITCH, STRIP_WIDTH_PITCH} from "../../project-file/stripboard-geometry";
import {COPPER_COLOR, HOLE_COLOR} from "../board-looks/board-look";
import {BOARD_COLOR as PERFBOARD_COLOR} from "../board-looks/perfboard-look";
import {BOARD_COLOR as STRIPBOARD_COLOR} from "../board-looks/stripboard-look";
import {getAdvancedComponentDefinition} from "../advanced-components/advanced-component-definitions";
import {rotateOffset} from "../advanced-components/rotate-offset";
import {LED_SOLID_COLORS} from "../standard-components/standard-component-render";

// A small picture of a project, drawn from its project file rather than the editor's state: the
// board and its copper, the wires, and a simple footprint for every part. For the Projects
// dialog, where it tells projects apart at a glance.

// Drawn at a fixed size and scaled by CSS: 16:10, and sharp on a 2x screen at the cards' width.
const WIDTH = 480;
const HEIGHT = 300;
const MARGIN = 22;

// Roughly the colors of the parts' icons.
const STANDARD_BODY_COLORS: Record<string, string> = {
  "resistor": "#d6bd94",
  "ceramic-capacitor": "#d99a4e",
  "electrolytic-capacitor": "#34618f",
  "inductor": "#3f3a34",
  "led": "#fafbfc",
  "diode": "#3a4046",
};
const ADVANCED_BODY_COLORS: Record<string, string> = {
  "potentiometer": "#9aa5b1",
};
const DARK_PART_COLOR = "#2a2f36";
const LEAD_COLOR = "#cbd5e1";
const PART_EDGE_COLOR = "rgba(226, 232, 240, 0.35)";
const HEADER_PIN_COLOR = "#facc15";

// Every hole a fixed-pin part puts a pin in or covers, as grid positions.
function advancedPartHoles(part: SavedAdvancedComponent): GridPos[] {
  const def = getAdvancedComponentDefinition(part.definitionId);
  if (!def) return [part.at];
  const offsets = def.gridSizable
    ? Array.from({length: part.rows * part.cols}, (_, i) => ({dx: i % part.cols, dy: Math.floor(i / part.cols)}))
    : [...def.pinOffsets, ...(def.shadedOffsets ?? [])];
  return offsets.map(({dx, dy}) => {
    const {x, y} = rotateOffset(dx, dy, part.rotation);
    return [part.at[0] + x, part.at[1] + y];
  });
}

export function drawProjectThumbnail(canvas: HTMLCanvasElement, project: ProjectFile) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const {board} = project;
  // One hole pitch, sized so the whole board fits.
  const pitch = Math.min((WIDTH - 2 * MARGIN) / board.cols, (HEIGHT - 2 * MARGIN) / board.rows);
  const left = (WIDTH - board.cols * pitch) / 2;
  const top = (HEIGHT - board.rows * pitch) / 2;
  const x = (col: number) => left + (col + 0.5) * pitch;
  const y = (row: number) => top + (row + 0.5) * pitch;
  const isStripboard = board.type === "stripboard";
  const boardColor = isStripboard ? STRIPBOARD_COLOR : PERFBOARD_COLOR;

  // The board, lifted off the backdrop by a soft shadow.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = boardColor;
  ctx.fillRect(left, top, board.cols * pitch, board.rows * pitch);
  ctx.restore();

  // A stripboard's copper strips, broken at each cut.
  if (board.type === "stripboard") {
    const horizontal = board.strips === "horizontal";
    const stripWidth = STRIP_WIDTH_PITCH * pitch;
    ctx.fillStyle = COPPER_COLOR;
    const strips = horizontal ? board.rows : board.cols;
    for (let i = 0; i < strips; i++) {
      if (horizontal) ctx.fillRect(left, y(i) - stripWidth / 2, board.cols * pitch, stripWidth);
      else ctx.fillRect(x(i) - stripWidth / 2, top, stripWidth, board.rows * pitch);
    }
    ctx.fillStyle = boardColor;
    const along = CUT_GAP_PITCH * pitch;
    const across = stripWidth + 1;
    for (const [col, row] of board.cuts) {
      if (horizontal) ctx.fillRect(x(col) - along / 2, y(row) - across / 2, along, across);
      else ctx.fillRect(x(col) - across / 2, y(row) - along / 2, across, along);
    }
  }

  // Holes, once they're big enough to read as holes rather than noise: a copper pad each on a
  // perfboard, just the drilled hole on a stripboard's strips. Marked pads keep their color.
  const marks = new Map(project.pads.filter(pad => pad.color).map(pad => [`${pad.at[0]},${pad.at[1]}`, pad.color as string]));
  if (pitch >= 4) {
    for (let col = 0; col < board.cols; col++) {
      for (let row = 0; row < board.rows; row++) {
        const mark = marks.get(`${col},${row}`);
        if (mark || !isStripboard) {
          ctx.fillStyle = mark ?? COPPER_COLOR;
          ctx.beginPath();
          ctx.arc(x(col), y(row), 0.24 * pitch, 0, Math.PI * 2);
          ctx.fill();
        }
        if (pitch >= 7) {
          ctx.fillStyle = HOLE_COLOR;
          ctx.beginPath();
          ctx.arc(x(col), y(row), 0.12 * pitch, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  const edge = Math.max(1, 0.05 * pitch);

  // IC bodies sit flat on the board, under the wires, as in the editor.
  for (const ic of project.placedIcs) {
    const inset = 0.38 * pitch;
    ctx.fillStyle = DARK_PART_COLOR;
    ctx.strokeStyle = PART_EDGE_COLOR;
    ctx.lineWidth = edge;
    const w = (ic.widthPin - 1) * pitch + 2 * inset;
    const h = (ic.heightPin - 1) * pitch + 2 * inset;
    ctx.fillRect(x(ic.at[0]) - inset, y(ic.at[1]) - inset, w, h);
    ctx.strokeRect(x(ic.at[0]) - inset, y(ic.at[1]) - inset, w, h);
  }

  ctx.lineCap = "round";
  for (const wire of project.wires) {
    ctx.strokeStyle = wire.color || "#3b82f6";
    ctx.lineWidth = Math.max(1.5, ((wire.width || 4) / 4) * 0.13 * pitch);
    ctx.beginPath();
    ctx.moveTo(x(wire.from[0]), y(wire.from[1]));
    ctx.lineTo(x(wire.to[0]), y(wire.to[1]));
    ctx.stroke();
  }

  // Flexible-lead parts: the leads hole to hole, with the body in the middle.
  for (const part of project.placedStandardComponents) {
    const x1 = x(part.from[0]), y1 = y(part.from[1]), x2 = x(part.to[0]), y2 = y(part.to[1]);
    const length = Math.hypot(x2 - x1, y2 - y1);
    if (length === 0) continue;
    ctx.strokeStyle = LEAD_COLOR;
    ctx.lineWidth = Math.max(1, 0.07 * pitch);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const body = Math.min(length * 0.7, 1.2 * pitch);
    const ux = (x2 - x1) / length, uy = (y2 - y1) / length;
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const isLed = part.definitionId === "led";
    ctx.strokeStyle = isLed && part.color ? LED_SOLID_COLORS[part.color] ?? "#e5e7eb" : STANDARD_BODY_COLORS[part.definitionId] ?? DARK_PART_COLOR;
    ctx.lineWidth = (part.definitionId === "electrolytic-capacitor" || isLed ? 0.8 : 0.45) * pitch;
    ctx.beginPath();
    ctx.moveTo(mx - (ux * body) / 2, my - (uy * body) / 2);
    ctx.lineTo(mx + (ux * body) / 2, my + (uy * body) / 2);
    ctx.stroke();
  }

  // Fixed-pin parts: a body over the holes they cover; header pins as a row of gold pins.
  for (const part of project.placedAdvancedComponents) {
    const holes = advancedPartHoles(part);
    const cols = holes.map(([col]) => col), rows = holes.map(([, row]) => row);
    const inset = 0.42 * pitch;
    const bx = x(Math.min(...cols)) - inset, by = y(Math.min(...rows)) - inset;
    const bw = (Math.max(...cols) - Math.min(...cols)) * pitch + 2 * inset;
    const bh = (Math.max(...rows) - Math.min(...rows)) * pitch + 2 * inset;
    ctx.fillStyle = ADVANCED_BODY_COLORS[part.definitionId] ?? DARK_PART_COLOR;
    ctx.strokeStyle = PART_EDGE_COLOR;
    ctx.lineWidth = edge;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);
    if (part.definitionId === "header-pins") {
      ctx.fillStyle = HEADER_PIN_COLOR;
      const pin = 0.26 * pitch;
      for (const [col, row] of holes) ctx.fillRect(x(col) - pin / 2, y(row) - pin / 2, pin, pin);
    }
  }
}
