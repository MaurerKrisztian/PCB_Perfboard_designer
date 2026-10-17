import {getComponentDefinition, getIconFile, isLed} from "../../parts/component-definitions";
import {gridToPx} from "../../project-file/grid";
import {SavedStandardComponent} from "../../project-file/project-file";
import {Painter} from "../painter/painter";
import {GHOST_DASH, GHOST_OPACITY, SELECTION_COLOR} from "../palette";
import {labelText, PartArtist} from "./part-artist";
import {decorationsFor} from "./standard-decorations";
import {standardPartSpan} from "./standard-geometry";

// Flexible-lead parts (resistors, capacitors, LEDs…): two leads from hole to hole and the part's
// icon as a square body between them, turned along the span.

const LEAD_COLOR = "#cbd5e1";
// Lead weight tracks the body so bigger parts don't end up with hairline leads: 4px at the
// 64px default body, matching the 4-viewBox-unit outline the icons are drawn with.
const LEAD_WIDTH_RATIO = 4 / 64;
// The icons leave a transparent margin inside their 100x100 viewBox (the resistor body starts
// at x=7, the LED's flat cathode edge at x=8), so a lead stopping at the body box would leave
// a green sliver before the artwork begins. Leads run this far past the box edge instead; the
// body is drawn over them afterwards, so the overlap never shows.
const LEAD_BODY_OVERLAP_RATIO = 0.12;
const LABEL_GAP = 3;

const ends = (part: SavedStandardComponent) => ({
  from: {x: gridToPx(part.from[0]), y: gridToPx(part.from[1])},
  to: {x: gridToPx(part.to[0]), y: gridToPx(part.to[1])},
});

// Until the icon is available (and if it never is): a box with the part's short name.
function drawStandIn(painter: Painter, bodyStart: number, bodySize: number, label: string, selected?: boolean, ghost?: boolean) {
  painter.rect(bodyStart, -bodySize / 2, bodySize, bodySize, {
    fill: selected ? "rgba(30,58,138,0.9)" : "rgba(17,24,39,0.85)",
    stroke: {paint: selected ? SELECTION_COLOR : "#475569", width: selected ? 3 : 2, ...(ghost ? {dash: GHOST_DASH} : {})},
  });
  painter.text(label, bodyStart + bodySize / 2, 1, {
    font: {family: "sans", size: 11, weight: 700}, color: "#ffffff", align: "center", baseline: "middle",
  });
}

export const standardArtist: PartArtist<SavedStandardComponent> = {
  layer: "over-wires",

  draw(painter, part, look) {
    const def = getComponentDefinition(part.definitionId);
    if (!def) return;
    const {from, to} = ends(part);
    const {length, angle, bodySize, bodyStart, bodyEnd} = standardPartSpan(from, to, def);
    if (length === 0) return;

    painter.group({translate: [from.x, from.y], rotate: angle, ...(look.ghost ? {opacity: GHOST_OPACITY} : {})}, () => {
      const lead = {
        paint: look.selected ? SELECTION_COLOR : LEAD_COLOR, width: bodySize * LEAD_WIDTH_RATIO, cap: "round" as const,
        ...(look.ghost ? {dash: GHOST_DASH} : {}),
      };
      const overlap = bodySize * LEAD_BODY_OVERLAP_RATIO;
      if (bodyStart > 0) painter.line([{x: 0, y: 0}, {x: bodyStart + overlap, y: 0}], lead);
      if (bodyEnd < length) painter.line([{x: bodyEnd - overlap, y: 0}, {x: length, y: 0}], lead);

      if (painter.image(getIconFile(def), bodyStart, -bodySize / 2, bodySize, bodySize)) {
        for (const decorate of decorationsFor(def)) decorate(painter, part, bodyStart, bodySize);
      } else {
        drawStandIn(painter, bodyStart, bodySize, def.fallbackLabel, look.selected, look.ghost);
      }
    });
  },

  // Beside the body: to its right when the part runs mostly up and down (or its left, if that's
  // off the board), else above it (or below).
  label(part) {
    const def = getComponentDefinition(part.definitionId);
    // LEDs store their colour name as the value, which the body's tint already shows.
    const text = labelText(part.ref, isLed(part.definitionId) ? undefined : part.value);
    if (!text || !def) return undefined;
    const {from, to} = ends(part);
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return undefined;

    // The visible artwork is a rectangle (full body length, artworkHalfThickness across) turned
    // to the part's angle. Clear its axis-aligned extent in the label's direction, so the text
    // hugs straight parts while diagonal ones don't get a corner poking into it.
    const {bodySize} = standardPartSpan(from, to, def);
    const halfLength = bodySize / 2;
    const halfThickness = bodySize * (def.artworkHalfThickness ?? 50) / 100;
    const cos = Math.abs(dx) / length, sin = Math.abs(dy) / length;
    const midX = (from.x + to.x) / 2, midY = (from.y + to.y) / 2;
    if (sin > cos) {
      const extentX = cos * halfLength + sin * halfThickness;
      return {text, spots: [
        (_w, h) => ({x: midX + extentX + LABEL_GAP, y: midY - h / 2}),
        (w, h) => ({x: midX - extentX - LABEL_GAP - w, y: midY - h / 2}),
      ]};
    }
    const extentY = sin * halfLength + cos * halfThickness;
    return {text, spots: [
      (w, h) => ({x: midX - w / 2, y: midY - extentY - LABEL_GAP - h}),
      (w) => ({x: midX - w / 2, y: midY + extentY + LABEL_GAP}),
    ]};
  },
};
