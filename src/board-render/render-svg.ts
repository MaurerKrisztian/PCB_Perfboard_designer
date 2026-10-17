import {ProjectFile} from "../project-file/project-file";
import {BoardView, PLAIN_VIEW} from "./board-view";
import {boardSizePx, drawBoard} from "./draw-board";
import {SvgIcons, SvgPainter} from "./painter/svg-painter";

// A board as a standalone SVG document. Runs anywhere (no DOM): the MCP server's Worker and SVG
// export both use it. `icons` hands over each part icon's SVG source; parts whose icon it doesn't
// have are drawn with their stand-in box.

export interface SvgRenderOptions {
  icons?: SvgIcons;
  view?: BoardView;
  // Display size per drawing px: 1 is 50px per hole pitch.
  scale?: number;
  idPrefix?: string;
}

export function renderBoardSvg(project: ProjectFile, options: SvgRenderOptions = {}): string {
  const painter = new SvgPainter({icons: options.icons, idPrefix: options.idPrefix});
  drawBoard(painter, project, options.view ?? PLAIN_VIEW);
  const {width, height} = boardSizePx(project.board);
  return painter.toSvg(width, height, options.scale ?? 1);
}
