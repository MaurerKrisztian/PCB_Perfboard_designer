import {boardSizePx, drawBoard, iconsUsedBy, renderBoardSvg} from "../../board-render";
import type {BoardView} from "../../board-render";
import {COMPONENT_ICON_DIR} from "../../parts/component-definitions";
import {ViewState} from "../../state/ViewState";
import {Utils} from "../../utils/utils";
import {ShortcutRegistry} from "../shortcut-keys";
import {CanvasPainter} from "../board-canvas/canvas-painter";
import {browserIcons} from "../board-canvas/browser-icons";
import {downloadFileName, getSaveJson} from "./save-project";

// The board as a picture, drawn by the board renderer from the project file: a PNG, or an SVG
// that stays sharp at any size. Only the board itself, as part labels show it right now; no
// selection, hover or tool preview.

// Fixed resolution multiplier for PNGs, independent of the current zoom/DPR, so the PNG is always
// the same crisp resolution regardless of what the user is viewing.
const EXPORT_SCALE = 2;

Utils.getSafeHtmlElement<HTMLButtonElement>('downloadBtn').addEventListener('click', () => void downloadAsImage());
Utils.getSafeHtmlElement<HTMLButtonElement>('downloadSvgBtn').addEventListener('click', () => void downloadAsSvg());

const exportView = (): BoardView => ({partLabels: ViewState.showPartLabels});

function download(href: string, extension: string) {
  const link = document.createElement('a');
  link.download = downloadFileName(extension);
  link.href = href;
  link.click();
}

export async function downloadAsImage() {
  const project = getSaveJson();
  await browserIcons.ready(iconsUsedBy(project));
  const {width, height} = boardSizePx(project.board);
  const canvas = document.createElement('canvas');
  canvas.width = width * EXPORT_SCALE;
  canvas.height = height * EXPORT_SCALE;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
  drawBoard(new CanvasPainter(ctx), project, exportView());
  download(canvas.toDataURL(), "png");
}

export async function downloadAsSvg() {
  const project = getSaveJson();
  // The SVG carries its icons inside it, so it shows the same anywhere it's opened.
  const icons = new Map<string, string>();
  await Promise.all(iconsUsedBy(project).map(async icon => {
    try {
      const response = await fetch(`${COMPONENT_ICON_DIR}${icon}`);
      if (response.ok) icons.set(icon, await response.text());
    } catch {
      // Left out: the part gets its stand-in box.
    }
  }));
  const svg = renderBoardSvg(project, {icons: icon => icons.get(icon), view: exportView()});
  const url = URL.createObjectURL(new Blob([svg], {type: "image/svg+xml"}));
  download(url, "svg");
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

ShortcutRegistry.add({key: "p", description: "download as image", event: () => void downloadAsImage()})
