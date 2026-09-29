import {Canvas} from "../state/Canvas";
import {ViewState} from "../state/ViewState";
import {StandardComponentState} from "../state/StandardComponentState";
import {AdvancedComponentState} from "../state/AdvancedComponentState";
import {GridConfig} from "../state/GridConfig";
import {IDot} from "../interfaces/dot.interface";
import {getComponentBodySize} from "./standard-components/component-definitions";
import {PinOffset} from "./advanced-components/advanced-component-definitions";
import {rotateOffset} from "./advanced-components/rotate-offset";

// Silkscreen-style value labels: upright white text with a dark halo (same trick as the
// advanced components' pin numbers) so they stay readable over dots, wires and bodies.
const LABEL_FONT_SIZE = 14;
const LABEL_FONT = `700 ${LABEL_FONT_SIZE}px monospace, sans-serif`;
// Keeps the halo stroke from being shaved off by the board edge.
const LABEL_EDGE_MARGIN = 2;
const LABEL_COLOR = "#f8fafc";
const LABEL_HALO_COLOR = "rgba(2,6,23,0.9)";
const LABEL_HALO_WIDTH = 3;
const LABEL_GAP = 3;

// LEDs store their color name as the value, which the body tint already shows.
const SKIPPED_DEFINITION_IDS = ["led"];

function getLabelText(definitionId: string, value?: string): string | undefined {
  if (SKIPPED_DEFINITION_IDS.indexOf(definitionId) !== -1) return undefined;
  const text = value?.trim();
  return text ? text : undefined;
}

// Where a label's box goes (its top-left), given the box's measured size.
type LabelPlacement = (w: number, h: number) => {x: number; y: number};

// Draws the label at the first placement whose box fits on the board, so parts along an
// edge get their label flipped to the other side instead of cut off. If nothing fits
// (e.g. a part in a corner of a tiny board), the preferred spot is nudged inside the edges.
function drawLabel(text: string, placements: LabelPlacement[]) {
  const w = Canvas.ctx.measureText(text).width;
  const h = LABEL_FONT_SIZE;
  const minX = LABEL_EDGE_MARGIN;
  const minY = LABEL_EDGE_MARGIN;
  const maxX = Canvas.gridWidth - LABEL_EDGE_MARGIN - w;
  const maxY = Canvas.gridHeight - LABEL_EDGE_MARGIN - h;

  const boxes = placements.map(place => place(w, h));
  const fitting = boxes.find(b => b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY);
  const box = fitting ?? {
    x: Math.min(Math.max(boxes[0].x, minX), maxX),
    y: Math.min(Math.max(boxes[0].y, minY), maxY),
  };

  Canvas.ctx.strokeText(text, box.x, box.y + h / 2);
  Canvas.ctx.fillText(text, box.x, box.y + h / 2);
}

function drawStandardComponentLabels() {
  for (const component of StandardComponentState.placedComponents) {
    const text = getLabelText(component.definitionId, component.value);
    const def = component.getDefinition();
    if (!text || !def) continue;

    const {startDot, endDot} = component;
    const dx = endDot.x - startDot.x;
    const dy = endDot.y - startDot.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) continue;

    // The visible artwork is a rectangle (full body length, artworkHalfThickness across)
    // turned to the part's angle. Clear its axis-aligned extent in the label's direction so
    // the text hugs straight parts while diagonal ones don't get a corner poking into it.
    const bodySize = getComponentBodySize(def);
    const halfLength = bodySize / 2;
    const halfThickness = bodySize * (def.artworkHalfThickness ?? 50) / 100;
    const cos = Math.abs(dx) / length;
    const sin = Math.abs(dy) / length;
    const midX = (startDot.x + endDot.x) / 2;
    const midY = (startDot.y + endDot.y) / 2;

    if (sin > cos) {
      // Mostly vertical: label to the right of the body, or the left if that's off the board.
      const extentX = cos * halfLength + sin * halfThickness;
      drawLabel(text, [
        (_w, h) => ({x: midX + extentX + LABEL_GAP, y: midY - h / 2}),
        (w, h) => ({x: midX - extentX - LABEL_GAP - w, y: midY - h / 2}),
      ]);
    } else {
      // Mostly horizontal: label above the body, or below if that's off the board.
      const extentY = sin * halfLength + cos * halfThickness;
      drawLabel(text, [
        (w, h) => ({x: midX - w / 2, y: midY - extentY - LABEL_GAP - h}),
        (w) => ({x: midX - w / 2, y: midY + extentY + LABEL_GAP}),
      ]);
    }
  }
}

// Printed on the package itself, so it turns with the part to stay along the body - but
// never upside down: 180 reads like 0, and 90/270 both read bottom-to-top.
function drawOnBodyLabel(text: string, anchor: IDot, offset: PinOffset, rotationAngle: 0 | 90 | 180 | 270) {
  const rotated = rotateOffset(offset.dx, offset.dy, rotationAngle);
  const x = anchor.x + rotated.x * GridConfig.dotSpace;
  const y = anchor.y + rotated.y * GridConfig.dotSpace;
  const quarterTurned = rotationAngle === 90 || rotationAngle === 270;

  Canvas.ctx.save();
  Canvas.ctx.translate(x, y);
  if (quarterTurned) Canvas.ctx.rotate(-Math.PI / 2);
  Canvas.ctx.textAlign = "center";
  Canvas.ctx.strokeText(text, 0, 0);
  Canvas.ctx.fillText(text, 0, 0);
  Canvas.ctx.restore();
}

function drawAdvancedComponentLabels() {
  // Below the body, since pin numbers sit above the pins by default; above only when the
  // part is on the bottom edge of the board.
  for (const component of AdvancedComponentState.placedComponents) {
    const text = getLabelText(component.definitionId, component.value);
    const def = component.getDefinition();
    if (!text || !def) continue;
    if (def.valueLabelOffset) {
      drawOnBodyLabel(text, component.anchorDot, def.valueLabelOffset, component.rotationAngle);
      continue;
    }
    const rect = component.getBodyRect();
    const centerX = rect.x + rect.w / 2;
    drawLabel(text, [
      (w) => ({x: centerX - w / 2, y: rect.y + rect.h + LABEL_GAP}),
      (w, h) => ({x: centerX - w / 2, y: rect.y - LABEL_GAP - h}),
    ]);
  }
}

export function drawComponentValueLabels() {
  if (!ViewState.showComponentValues) return;

  Canvas.ctx.save();
  Canvas.ctx.setLineDash([]);
  Canvas.ctx.font = LABEL_FONT;
  Canvas.ctx.fillStyle = LABEL_COLOR;
  Canvas.ctx.strokeStyle = LABEL_HALO_COLOR;
  Canvas.ctx.lineWidth = LABEL_HALO_WIDTH;
  Canvas.ctx.lineJoin = "round";
  // Placements are computed as top-left boxes, drawn vertically centered in their box.
  Canvas.ctx.textAlign = "left";
  Canvas.ctx.textBaseline = "middle";
  drawStandardComponentLabels();
  drawAdvancedComponentLabels();
  Canvas.ctx.restore();
}
