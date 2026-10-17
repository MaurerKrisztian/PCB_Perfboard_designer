import {cssFont} from "../../board-render";
import type {Font, GroupOptions, IconSize, Paint, Painter, PathData, Point, ShapeStyle, Stamp, Stroke, TextStyle} from "../../board-render";
import {browserIcons} from "./browser-icons";

// The board renderer's Painter for a 2D canvas: the editor's board, PNG export and thumbnails.
// Two things here are only about how a canvas shows pixels:
// - stamps are rendered once into a small sprite at exactly the size they end up on screen (one
//   per zoom level), then copied. A board has thousands of holes and the editor redraws on every
//   mouse move; and scaling one big sprite down instead breaks thin copper rings into blotches.
// - unrotated text lands on whole device pixels, since glyphs on a fractional pixel look soft.

const MAX_CACHED_SPRITES = 8;

export class CanvasPainter implements Painter {
  private readonly sprites = new Map<string, HTMLCanvasElement>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  circle(cx: number, cy: number, r: number, style: ShapeStyle) {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    this.paintPath(style);
  }

  arc(cx: number, cy: number, r: number, start: number, end: number, style: ShapeStyle) {
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, r, start, end);
    this.ctx.closePath();
    this.paintPath(style);
  }

  rect(x: number, y: number, w: number, h: number, style: ShapeStyle, cornerRadius = 0) {
    const ctx = this.ctx;
    const r = Math.min(cornerRadius, w / 2, h / 2);
    ctx.beginPath();
    if (r > 0) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    } else {
      ctx.rect(x, y, w, h);
    }
    this.paintPath(style);
  }

  line(points: Point[], stroke: Stroke) {
    if (points.length < 2) return;
    this.tracePoints(points, false);
    this.paintPath({stroke});
  }

  polygon(points: Point[], style: ShapeStyle) {
    if (points.length < 3) return;
    this.tracePoints(points, true);
    this.paintPath(style);
  }

  path(d: PathData, style: ShapeStyle) {
    this.paintPath(style, new Path2D(d));
  }

  text(text: string, x: number, y: number, style: TextStyle) {
    if (!text) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = cssFont(style.font);
    ctx.textAlign = style.align ?? "left";
    ctx.textBaseline = style.baseline ?? "alphabetic";
    let maxWidth = style.maxWidth;
    let haloWidth = style.halo?.width ?? 0;
    // On whole device pixels, unless the text is turned.
    const t = ctx.getTransform();
    if (t.b === 0 && t.c === 0) {
      x = Math.round(t.a * x + t.e);
      y = Math.round(t.d * y + t.f);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.font = cssFont({...style.font, size: Math.round(style.font.size * t.d * 2) / 2});
      if (maxWidth !== undefined) maxWidth *= t.a;
      haloWidth *= t.a;
    }
    if (style.halo) {
      ctx.strokeStyle = style.halo.color;
      ctx.lineWidth = haloWidth;
      ctx.lineJoin = "round";
      ctx.strokeText(text, x, y, maxWidth);
    }
    ctx.fillStyle = style.color;
    ctx.fillText(text, x, y, maxWidth);
    ctx.restore();
  }

  measureText(text: string, font: Font): number {
    this.ctx.save();
    this.ctx.font = cssFont(font);
    const width = this.ctx.measureText(text).width;
    this.ctx.restore();
    return width;
  }

  iconSize(icon: string): IconSize | undefined {
    const img = browserIcons.image(icon);
    return img && img.naturalWidth && img.naturalHeight ? {width: img.naturalWidth, height: img.naturalHeight} : undefined;
  }

  image(icon: string, x: number, y: number, w: number, h: number): boolean {
    const img = browserIcons.image(icon);
    if (!img) return false;
    this.ctx.drawImage(img, x, y, w, h);
    return true;
  }

  group(options: GroupOptions, draw: () => void) {
    const ctx = this.ctx;
    ctx.save();
    if (options.translate) ctx.translate(options.translate[0], options.translate[1]);
    if (options.rotate) ctx.rotate(options.rotate);
    if (options.scale !== undefined) ctx.scale(options.scale, options.scale);
    if (options.opacity !== undefined) ctx.globalAlpha *= options.opacity;
    if (options.clip) ctx.clip(new Path2D(options.clip));
    draw();
    ctx.restore();
  }

  stamp(stamp: Stamp, points: Point[]) {
    const ctx = this.ctx;
    // The canvas only ever scales and translates here, so a = d is the device pixels per drawing
    // pixel (zoom × devicePixelRatio, or the export scale).
    const {a: scale, e: offsetX, f: offsetY} = ctx.getTransform();
    const sprite = this.sprite(stamp, Math.max(0.05, Math.round(scale * 100) / 100));
    const w = sprite.width / scale, h = sprite.height / scale;
    for (const p of points) {
      // Land each copy on whole device pixels: a sub-pixel offset would blur each one differently,
      // which makes small holes look uneven when zoomed out.
      const left = Math.round(p.x * scale + offsetX - sprite.width / 2);
      const top = Math.round(p.y * scale + offsetY - sprite.height / 2);
      ctx.drawImage(sprite, (left - offsetX) / scale, (top - offsetY) / scale, w, h);
    }
  }

  private sprite(stamp: Stamp, scale: number): HTMLCanvasElement {
    const key = `${stamp.id}@${scale}`;
    let sprite = this.sprites.get(key);
    if (sprite) return sprite;
    if (this.sprites.size >= MAX_CACHED_SPRITES) this.sprites.clear();
    sprite = document.createElement("canvas");
    sprite.width = sprite.height = Math.max(2, Math.ceil((stamp.radius + 1) * 2 * scale));
    const spriteCtx = sprite.getContext("2d") as CanvasRenderingContext2D;
    spriteCtx.setTransform(scale, 0, 0, scale, sprite.width / 2, sprite.height / 2);
    stamp.draw(new CanvasPainter(spriteCtx));
    this.sprites.set(key, sprite);
    return sprite;
  }

  private tracePoints(points: Point[], close: boolean) {
    this.ctx.beginPath();
    this.ctx.moveTo(points[0].x, points[0].y);
    for (const p of points.slice(1)) this.ctx.lineTo(p.x, p.y);
    if (close) this.ctx.closePath();
  }

  private toCanvasPaint(paint: Paint): string | CanvasGradient {
    if (typeof paint === "string") return paint;
    const gradient = this.ctx.createLinearGradient(paint.x1, paint.y1, paint.x2, paint.y2);
    for (const stop of paint.stops) gradient.addColorStop(stop.offset, stop.color);
    return gradient;
  }

  // Fills, then strokes, the current path (or `path`).
  private paintPath({fill, stroke}: ShapeStyle, path?: Path2D) {
    const ctx = this.ctx;
    if (fill) {
      ctx.fillStyle = this.toCanvasPaint(fill);
      if (path) ctx.fill(path);
      else ctx.fill();
    }
    if (stroke) {
      ctx.save();
      ctx.strokeStyle = this.toCanvasPaint(stroke.paint);
      ctx.lineWidth = stroke.width;
      ctx.lineCap = stroke.cap ?? "butt";
      ctx.lineJoin = stroke.join ?? "miter";
      ctx.setLineDash(stroke.dash ?? []);
      if (path) ctx.stroke(path);
      else ctx.stroke();
      ctx.restore();
    }
  }
}
