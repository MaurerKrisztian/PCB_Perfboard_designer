import {estimateTextWidth, fontFamily} from "./fonts";
import {Font, GroupOptions, IconSize, Paint, Painter, PathData, Point, ShapeStyle, Stamp, Stroke, TextStyle} from "./painter";

// A Painter that writes an SVG document, as a string: no DOM, so it runs anywhere (browser,
// Node, Cloudflare Workers). Gradients, clip paths, stamps and icons go into <defs> once and are
// referenced by id; ids start with `idPrefix`, so several of these SVGs can share one HTML page.

// An icon's SVG source, by file name ("resistor.svg"); undefined when it isn't available.
export type SvgIcons = (icon: string) => string | undefined;

export interface SvgPainterOptions {
  icons?: SvgIcons;
  idPrefix?: string;
}

const num = (n: number) => String(Math.round(n * 100) / 100);

const escapeXml = (text: string) => text.replace(/[&<>"']/g, ch => `&#${ch.charCodeAt(0)};`);

// Colours can come from a project file, which anyone can write, and the SVG may be served as is:
// only plain colour syntax ("#b7733b", "red", "rgba(2,6,23,0.9)") gets in, never markup or url().
const COLOR = /^(?!url)[#a-z0-9\s(),.%-]+$/i;
const safeColor = (color: string) => COLOR.test(color) ? color : "none";

// An icon's own size, from its root <svg>'s width and height, else its viewBox.
function readIconSize(svg: string): IconSize | undefined {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!root) return undefined;
  const attr = (name: string) => new RegExp(`\\s${name}="([\\d.]+)(px)?"`).exec(root)?.[1];
  const width = Number(attr("width")), height = Number(attr("height"));
  if (width > 0 && height > 0) return {width, height};
  const viewBox = /\sviewBox="([^"]+)"/.exec(root)?.[1]?.trim().split(/[\s,]+/).map(Number);
  return viewBox && viewBox[2] > 0 && viewBox[3] > 0 ? {width: viewBox[2], height: viewBox[3]} : undefined;
}

export class SvgPainter implements Painter {
  private out: string[] = [];
  private readonly defs: string[] = [];
  private readonly ids = new Map<string, string>();
  private nextId = 0;
  private readonly iconSizes = new Map<string, IconSize | undefined>();

  constructor(private readonly options: SvgPainterOptions = {}) {}

  // The finished document, `width` × `height` drawing pixels shown at `scale`.
  toSvg(width: number, height: number, scale = 1): string {
    const defs = this.defs.length ? `<defs>${this.defs.join("")}</defs>` : "";
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(width)} ${num(height)}" width="${num(width * scale)}" height="${num(height * scale)}">`
      + `${defs}<g stroke-miterlimit="10">${this.out.join("")}</g></svg>`;
  }

  circle(cx: number, cy: number, r: number, style: ShapeStyle) {
    this.out.push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}"${this.styleAttrs(style)}/>`);
  }

  arc(cx: number, cy: number, r: number, start: number, end: number, style: ShapeStyle) {
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    this.path(`M ${num(x1)} ${num(y1)} A ${num(r)} ${num(r)} 0 ${large} 1 ${num(x2)} ${num(y2)} Z`, style);
  }

  rect(x: number, y: number, w: number, h: number, style: ShapeStyle, cornerRadius = 0) {
    const r = Math.min(cornerRadius, w / 2, h / 2);
    const rounded = r > 0 ? ` rx="${num(r)}"` : "";
    this.out.push(`<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"${rounded}${this.styleAttrs(style)}/>`);
  }

  line(points: Point[], stroke: Stroke) {
    if (points.length < 2) return;
    this.out.push(`<polyline points="${points.map(p => `${num(p.x)},${num(p.y)}`).join(" ")}"${this.styleAttrs({stroke})}/>`);
  }

  polygon(points: Point[], style: ShapeStyle) {
    if (points.length < 3) return;
    this.out.push(`<polygon points="${points.map(p => `${num(p.x)},${num(p.y)}`).join(" ")}"${this.styleAttrs(style)}/>`);
  }

  path(d: PathData, style: ShapeStyle) {
    this.out.push(`<path d="${d}"${this.styleAttrs(style)}/>`);
  }

  text(text: string, x: number, y: number, style: TextStyle) {
    if (!text) return;
    const {font} = style;
    const anchor = style.align === "center" ? "middle" : style.align === "right" ? "end" : "start";
    const attrs = [
      `x="${num(x)}"`, `y="${num(y)}"`,
      `font-family="${fontFamily(font)}"`, `font-size="${num(font.size)}"`,
      ...(font.weight && font.weight !== 400 ? [`font-weight="${font.weight}"`] : []),
      `fill="${safeColor(style.color)}"`,
      ...(anchor !== "start" ? [`text-anchor="${anchor}"`] : []),
      ...(style.baseline === "middle" ? [`dominant-baseline="central"`] : []),
      ...(style.halo ? [
        `stroke="${safeColor(style.halo.color)}"`, `stroke-width="${num(style.halo.width)}"`,
        `stroke-linejoin="round"`, `paint-order="stroke"`,
      ] : []),
      ...(style.maxWidth !== undefined && estimateTextWidth(text, font) > style.maxWidth
        ? [`textLength="${num(style.maxWidth)}"`, `lengthAdjust="spacingAndGlyphs"`] : []),
    ];
    this.out.push(`<text ${attrs.join(" ")}>${escapeXml(text)}</text>`);
  }

  measureText(text: string, font: Font): number {
    return estimateTextWidth(text, font);
  }

  iconSize(icon: string): IconSize | undefined {
    if (!this.iconSizes.has(icon)) {
      const svg = this.options.icons?.(icon);
      this.iconSizes.set(icon, svg ? readIconSize(svg) : undefined);
    }
    return this.iconSizes.get(icon);
  }

  image(icon: string, x: number, y: number, w: number, h: number): boolean {
    const size = this.iconSize(icon);
    const svg = this.options.icons?.(icon);
    if (!size || !svg) return false;
    // Each icon once, as a <symbol> holding it as an image: stretched to the box like drawImage,
    // and kept apart from the document, so ids inside different icons can't clash.
    const id = this.defineOnce(`icon:${icon}`, id =>
      `<symbol id="${id}" viewBox="0 0 ${num(size.width)} ${num(size.height)}" preserveAspectRatio="none">`
      + `<image width="${num(size.width)}" height="${num(size.height)}" href="data:image/svg+xml,${encodeURIComponent(svg)}"/></symbol>`);
    this.out.push(`<use href="#${id}" x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}"/>`);
    return true;
  }

  group(options: GroupOptions, draw: () => void) {
    const transform = [
      options.translate ? `translate(${num(options.translate[0])} ${num(options.translate[1])})` : "",
      options.rotate ? `rotate(${num((options.rotate * 180) / Math.PI)})` : "",
      options.scale !== undefined && options.scale !== 1 ? `scale(${num(options.scale)})` : "",
    ].filter(Boolean).join(" ");
    const attrs = [
      transform ? `transform="${transform}"` : "",
      options.opacity !== undefined && options.opacity !== 1 ? `opacity="${num(options.opacity)}"` : "",
      options.clip ? `clip-path="url(#${this.defineOnce(`clip:${options.clip}`, id => `<clipPath id="${id}"><path d="${options.clip}"/></clipPath>`)})"` : "",
    ].filter(Boolean).join(" ");
    this.out.push(attrs ? `<g ${attrs}>` : "<g>");
    draw();
    this.out.push("</g>");
  }

  stamp(stamp: Stamp, points: Point[]) {
    if (!points.length) return;
    const id = this.defineOnce(`stamp:${stamp.id}`, id => `<g id="${id}">${this.capture(() => stamp.draw(this))}</g>`);
    for (const p of points) this.out.push(`<use href="#${id}" x="${num(p.x)}" y="${num(p.y)}"/>`);
  }

  // What `draw` paints, as markup, instead of adding it to the document.
  private capture(draw: () => void): string {
    const outer = this.out;
    this.out = [];
    draw();
    const inner = this.out.join("");
    this.out = outer;
    return inner;
  }

  // The id of a def, writing it the first time it's asked for.
  private defineOnce(key: string, write: (id: string) => string): string {
    let id = this.ids.get(key);
    if (!id) {
      id = `${this.options.idPrefix ?? "b"}${this.nextId++}`;
      this.ids.set(key, id);
      this.defs.push(write(id));
    }
    return id;
  }

  private paint(paint: Paint): string {
    if (typeof paint === "string") return safeColor(paint);
    const key = `grad:${JSON.stringify(paint)}`;
    return `url(#${this.defineOnce(key, id =>
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(paint.x1)}" y1="${num(paint.y1)}" x2="${num(paint.x2)}" y2="${num(paint.y2)}">`
      + paint.stops.map(s => `<stop offset="${num(s.offset)}" stop-color="${safeColor(s.color)}"/>`).join("")
      + `</linearGradient>`)})`;
  }

  private styleAttrs({fill, stroke}: ShapeStyle): string {
    let attrs = ` fill="${fill ? this.paint(fill) : "none"}"`;
    if (stroke) {
      attrs += ` stroke="${this.paint(stroke.paint)}" stroke-width="${num(stroke.width)}"`;
      if (stroke.cap && stroke.cap !== "butt") attrs += ` stroke-linecap="${stroke.cap}"`;
      if (stroke.join && stroke.join !== "miter") attrs += ` stroke-linejoin="${stroke.join}"`;
      if (stroke.dash?.length) attrs += ` stroke-dasharray="${stroke.dash.join(" ")}"`;
    }
    return attrs;
  }
}
