import {Painter, TextStyle} from "../painter/painter";
import {LABEL_COLOR, LABEL_HALO} from "../palette";
import {BoardPart, PartLabel} from "../artists/part-artist";
import {artistFor} from "../artists";

// Silkscreen-style part labels, each part's ref and value ("R1 10kΩ"): upright light text with a
// dark halo, so they stay readable over holes, wires and bodies. Where each goes is the part's
// artist's call (PartArtist.label); this keeps them on the board.

const LABEL_FONT = {family: "mono", size: 14, weight: 700} as const;
// Keeps the halo stroke from being shaved off by the board edge.
const LABEL_EDGE_MARGIN = 2;

const STYLE: TextStyle = {font: LABEL_FONT, color: LABEL_COLOR, halo: LABEL_HALO, baseline: "middle"};

// At the first spot whose box fits on the board, so parts along an edge get their label flipped
// to the other side instead of cut off. If none fits (a part in a corner of a tiny board), the
// preferred spot is nudged inside the edges.
function drawBeside(painter: Painter, label: Extract<PartLabel, {spots: unknown}>, width: number, height: number) {
  const w = painter.measureText(label.text, LABEL_FONT);
  const h = LABEL_FONT.size;
  const minX = LABEL_EDGE_MARGIN, minY = LABEL_EDGE_MARGIN;
  const maxX = width - LABEL_EDGE_MARGIN - w, maxY = height - LABEL_EDGE_MARGIN - h;
  const boxes = label.spots.map(spot => spot(w, h));
  const box = boxes.find(b => b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY) ?? {
    x: Math.min(Math.max(boxes[0].x, minX), maxX),
    y: Math.min(Math.max(boxes[0].y, minY), maxY),
  };
  painter.text(label.text, box.x, box.y + h / 2, {...STYLE, align: "left"});
}

// Printed on the package, turned with it to stay along the body, but never upside down.
function drawOnBody(painter: Painter, label: Extract<PartLabel, {at: unknown}>) {
  painter.group({translate: [label.at.x, label.at.y], rotate: label.vertical ? -Math.PI / 2 : 0}, () => {
    painter.text(label.text, 0, 0, {...STYLE, align: "center", baseline: "alphabetic"});
  });
}

export function drawPartLabels(painter: Painter, parts: BoardPart[], width: number, height: number) {
  for (const part of parts) {
    const label = artistFor(part).label?.(part.entry);
    if (!label) continue;
    if ("spots" in label) drawBeside(painter, label, width, height);
    else drawOnBody(painter, label);
  }
}
