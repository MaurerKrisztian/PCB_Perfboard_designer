import {GRID_PITCH_PX, gridToPx} from "../../project-file/grid";
import {isModulePart} from "../../parts/ic-package";
import {icPins} from "../../parts/part-geometry";
import {SavedIc} from "../../project-file/project-file";
import {Painter, TextStyle} from "../painter/painter";
import {SELECTION_COLOR} from "../palette";
import {DIP_INSET, drawDip} from "./ic-package/dip-shape";
import {drawModule} from "./ic-package/module-shape";
import {PartArtist} from "./part-artist";

// Dual-row parts: DIP chips, and dev boards (Modules › Dev Boards), which get a board's look. The
// package lies flat under the holes; a ring on every pin and the pin numbers with their names
// ("1:GND") go on top of everything, so they read over wires and parts.

const PIN_RING_RADIUS = 5;
const PIN_LABEL = {font: {family: "mono", size: 9, weight: 600}, color: "#cbd5e1", baseline: "alphabetic"} as const;
const GHOST_OPACITY = 0.65;

const isModule = (chip: SavedIc) => isModulePart(chip.category, chip.name);

function drawPinLabels(painter: Painter, chip: SavedIc) {
  const module = isModule(chip);
  const left = gridToPx(chip.at[0]), top = gridToPx(chip.at[1]);
  const right = left + GRID_PITCH_PX * (chip.widthPin - 1);
  const bottom = top + GRID_PITCH_PX * (chip.heightPin - 1);
  // How far labels sit inside the pin rows: a DIP's body starts DIP_INSET inside them.
  const sideInset = module ? 10 : DIP_INSET + 4;
  const topInset = module ? 16 : DIP_INSET + 11;
  const bottomInset = module ? 10 : DIP_INSET + 2;
  // Keep each side's labels on its half of the body, clear of the name printed down the middle.
  const sideMax = module ? undefined : Math.max(20, (GRID_PITCH_PX * (chip.widthPin - 1)) / 2 - sideInset - 12);
  const endMax = module ? undefined : 46;
  const label = (pin: number, nameFirst: boolean) => {
    const name = chip.pinDescription[pin];
    if (!name) return `${pin}`;
    return nameFirst ? `${name}:${pin}` : `${pin}:${name}`;
  };
  const text = (content: string, x: number, y: number, style: Pick<TextStyle, "align" | "maxWidth">) =>
    painter.text(content, x, y, {...PIN_LABEL, ...style});

  // Each row's labels read inwards from its side: the number on the outside, the name towards the
  // middle.
  for (const {pin, at, side} of icPins(chip)) {
    const x = gridToPx(at[0]), y = gridToPx(at[1]);
    if (side === "left") text(label(pin, false), left + sideInset, y + 3, {align: "left", maxWidth: sideMax});
    else if (side === "right") text(label(pin, true), right - sideInset, y + 3, {align: "right", maxWidth: sideMax});
    else if (side === "top") text(label(pin, false), x, top + topInset, {align: "center", maxWidth: endMax});
    else text(label(pin, true), x, bottom - bottomInset, {align: "center", maxWidth: endMax});
  }
}

export const icArtist: PartArtist<SavedIc> = {
  layer: "under-board",

  draw(painter, chip, look) {
    const paint = {
      x: gridToPx(chip.at[0]),
      y: gridToPx(chip.at[1]),
      widthPin: chip.widthPin,
      heightPin: chip.heightPin,
      rotation: chip.rotation,
      selected: !!look.selected,
      // Chips and boards print their name on the package itself, with the ref when labels are on.
      title: look.showRef && chip.ref ? `${chip.ref} ${chip.name}` : chip.name,
    };
    painter.group(look.ghost ? {opacity: GHOST_OPACITY} : {}, () => {
      if (isModule(chip)) drawModule(painter, paint);
      else drawDip(painter, paint);
    });
  },

  drawOverlay(painter, chip) {
    for (const {at} of icPins(chip)) {
      painter.circle(gridToPx(at[0]), gridToPx(at[1]), PIN_RING_RADIUS, {stroke: {paint: SELECTION_COLOR, width: 1.5}});
    }
    drawPinLabels(painter, chip);
  },
};
