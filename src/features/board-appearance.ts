import {Canvas} from "../state/Canvas";
import {GridConfig} from "../state/GridConfig";

// Perfboard look: a flat dark-green board with a thin copper ring and a dark drilled hole at every
// grid dot. redrawCanvas runs on every mouse move, so the pad is pre-rendered once into a small
// offscreen canvas and then just stamped. Purely visual: hit testing still uses
// GridConfig.dotRadius and friends.

// The color every dot starts with; any other color means the user marked that hole.
export const DEFAULT_DOT_COLOR = "#a4a0a0";

// In drawing pixels, where one hole pitch is GridConfig.dotSpace (50px).
export const PAD_RADIUS = 10.5;
const HOLE_RADIUS = 6.3;
const COPPER_COLOR = "#b7733b";
const HOLE_COLOR = "#0a170b";

// The pad is pre-rendered at exactly the size it ends up on screen (one sprite per zoom level /
// export scale), so drawing it is a 1:1 copy. Scaling a single big sprite down instead breaks the
// thin copper ring into blotchy squares when zoomed far out.
const padSprites = new Map<number, HTMLCanvasElement>();
const MAX_CACHED_SPRITES = 8;

function getPadSprite(scale: number): HTMLCanvasElement {
  let sprite = padSprites.get(scale);
  if (sprite) return sprite;
  if (padSprites.size >= MAX_CACHED_SPRITES) padSprites.clear();

  sprite = document.createElement("canvas");
  sprite.width = sprite.height = Math.max(2, Math.ceil((PAD_RADIUS + 1) * 2 * scale));
  const ctx = sprite.getContext("2d") as CanvasRenderingContext2D;
  const c = sprite.width / 2;

  ctx.fillStyle = COPPER_COLOR;
  ctx.beginPath();
  ctx.arc(c, c, PAD_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = HOLE_COLOR;
  ctx.beginPath();
  ctx.arc(c, c, HOLE_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();

  padSprites.set(scale, sprite);
  return sprite;
}

/** Stamps a copper pad, centered on (x, y) in drawing coordinates. */
export function drawPad(x: number, y: number) {
  // The canvas only ever scales and translates, so a = d is the device pixels per drawing pixel
  // (zoom x devicePixelRatio, or the export scale).
  const {a: scale, e: offsetX, f: offsetY} = Canvas.ctx.getTransform();
  const sprite = getPadSprite(Math.max(0.05, Math.round(scale * 100) / 100));
  // Land the sprite on whole device pixels: a sub-pixel offset would blur each copy differently,
  // which is what makes small pads look uneven when zoomed out.
  const left = Math.round(x * scale + offsetX - sprite.width / 2);
  const top = Math.round(y * scale + offsetY - sprite.height / 2);
  Canvas.ctx.drawImage(sprite, (left - offsetX) / scale, (top - offsetY) / scale, sprite.width / scale, sprite.height / scale);
}

/** A pad the user has marked with a color: the ring in that color, hole still drilled through. */
export function drawMarkedPad(x: number, y: number, color: string) {
  const ctx = Canvas.ctx;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, PAD_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HOLE_COLOR;
  ctx.beginPath();
  ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Paints the bare board over the whole canvas. */
export function paintBoard(width: number, height: number) {
  Canvas.ctx.fillStyle = GridConfig.canvasBackgroundColor;
  Canvas.ctx.fillRect(0, 0, width, height);
}
