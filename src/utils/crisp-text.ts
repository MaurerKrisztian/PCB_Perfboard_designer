// Draws text with its origin on a whole device pixel. Glyphs placed on a fractional pixel get
// resampled and look soft, which shows at small zoomed-out sizes. Only for unrotated, unskewed
// transforms (the board's zoom scale), where snapping is just rounding.
export function fillCrispText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number): void {
  const t = ctx.getTransform();
  if (t.b !== 0 || t.c !== 0) {
    ctx.fillText(text, x, y, maxWidth);
    return;
  }
  const sx = Math.round(t.a * x + t.e);
  const sy = Math.round(t.d * y + t.f);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = scaleFont(ctx.font, t.d);
  ctx.fillText(text, sx, sy, maxWidth === undefined ? undefined : maxWidth * t.a);
  ctx.restore();
}

// Rewrites the px size in a canvas font string, so the text keeps its on-screen size once the
// zoom transform is dropped.
function scaleFont(font: string, scale: number): string {
  return font.replace(/(\d+(?:\.\d+)?)px/, (_, size) => `${Math.round(parseFloat(size) * scale * 2) / 2}px`);
}
