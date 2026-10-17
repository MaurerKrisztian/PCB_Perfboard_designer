import {ProjectFile} from "../../project-file/project-file";
import {getComponentDefinition, getIconFile} from "../../parts/component-definitions";
import {getAdvancedComponentDefinition} from "../../parts/advanced-component-definitions";
import {Painter} from "../painter/painter";
import {advancedArtist} from "./advanced-artist";
import {icArtist} from "./ic-artist";
import {BoardPart, PartArtist, PartLook} from "./part-artist";
import {standardArtist} from "./standard-artist";

// Every kind of placed part and its artist. A new kind of part is a new artist and a line here
// (plus its BoardPart variant and its array in the project file).
const ARTISTS: {[Kind in BoardPart["kind"]]: PartArtist<Extract<BoardPart, {kind: Kind}>["entry"]>} = {
  "ic": icArtist,
  "standard-component": standardArtist,
  "advanced-component": advancedArtist,
};

// The artist for a part, typed for its entry.
export function artistFor(part: BoardPart): PartArtist<BoardPart["entry"]> {
  return ARTISTS[part.kind] as PartArtist<BoardPart["entry"]>;
}

// Every part on the board, in stacking order: chips, then flexible-lead parts, then fixed-pin
// ones, each in its array's order, as the editor has always stacked them.
export function boardParts(project: ProjectFile): BoardPart[] {
  return [
    ...project.placedIcs.map(entry => ({kind: "ic", entry}) as const),
    ...project.placedStandardComponents.map(entry => ({kind: "standard-component", entry}) as const),
    ...project.placedAdvancedComponents.map(entry => ({kind: "advanced-component", entry}) as const),
  ];
}

// One part on its own, as a tool previews where it would go.
export function drawPart(painter: Painter, part: BoardPart, look: PartLook) {
  artistFor(part).draw(painter, part.entry, look);
}

// The icon files a board's parts are drawn with, for painters that have to fetch them first.
export function iconsUsedBy(project: ProjectFile): string[] {
  const icons = new Set<string>();
  for (const part of project.placedStandardComponents) {
    const def = getComponentDefinition(part.definitionId);
    if (def) icons.add(getIconFile(def));
  }
  for (const part of project.placedAdvancedComponents) {
    const def = getAdvancedComponentDefinition(part.definitionId);
    if (def) icons.add(getIconFile(def));
  }
  return [...icons];
}
