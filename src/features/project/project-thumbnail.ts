import {boardSizePx, drawBoard, iconsUsedBy, PLAIN_VIEW} from "../../board-render";
import type {ProjectFile} from "../../project-file/project-file";
import {CanvasPainter} from "../board-canvas/canvas-painter";
import {browserIcons} from "../board-canvas/browser-icons";

// A small picture of a project for the Projects dialog, where it tells projects apart at a glance:
// the board as the editor draws it (by the board renderer, from the project file), scaled to fit
// and lifted off the backdrop by a soft shadow.

// Drawn at a fixed size and scaled by CSS: 16:10, and sharp on a 2x screen at the cards' width.
const WIDTH = 480;
const HEIGHT = 300;
const MARGIN = 22;

function draw(canvas: HTMLCanvasElement, project: ProjectFile) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const {width, height} = boardSizePx(project.board);
  const scale = Math.min((WIDTH - 2 * MARGIN) / width, (HEIGHT - 2 * MARGIN) / height);
  const left = (WIDTH - width * scale) / 2;
  const top = (HEIGHT - height * scale) / 2;

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = "#000";
  ctx.fillRect(left, top, width * scale, height * scale);
  ctx.restore();

  ctx.setTransform(scale, 0, 0, scale, left, top);
  drawBoard(new CanvasPainter(ctx), project, PLAIN_VIEW);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

export function drawProjectThumbnail(canvas: HTMLCanvasElement, project: ProjectFile) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  draw(canvas, project);
  // Parts whose icon hasn't loaded yet got their stand-in box: draw it again once they have.
  const icons = iconsUsedBy(project);
  if (icons.some(icon => !browserIcons.image(icon))) void browserIcons.ready(icons).then(() => draw(canvas, project));
}
