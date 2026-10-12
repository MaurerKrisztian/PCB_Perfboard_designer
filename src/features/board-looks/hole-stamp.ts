import {Canvas} from "../../state/Canvas";

// Artwork drawn at every hole, pre-rendered into a small offscreen canvas and then just stamped:
// redrawCanvas runs on every mouse move, and a board has hundreds of holes.
//
// The sprite is rendered at exactly the size it ends up on screen (one sprite per zoom level /
// export scale), so drawing it is a 1:1 copy. Scaling a single big sprite down instead breaks thin
// copper rings into blotchy squares when zoomed far out.
const MAX_CACHED_SPRITES = 8;

// Paints the artwork centered on (center, center), with every size multiplied by `scale`.
type PaintHole = (ctx: CanvasRenderingContext2D, center: number, scale: number) => void;

export class HoleStamp {
  private readonly sprites = new Map<number, HTMLCanvasElement>();

  // `radius` is the artwork's extent in drawing pixels.
  constructor(private readonly radius: number, private readonly paint: PaintHole) {}

  /** Stamps the artwork, centered on (x, y) in drawing coordinates. */
  draw(x: number, y: number) {
    // The canvas only ever scales and translates, so a = d is the device pixels per drawing pixel
    // (zoom x devicePixelRatio, or the export scale).
    const {a: scale, e: offsetX, f: offsetY} = Canvas.ctx.getTransform();
    const sprite = this.sprite(Math.max(0.05, Math.round(scale * 100) / 100));
    // Land the sprite on whole device pixels: a sub-pixel offset would blur each copy differently,
    // which is what makes small holes look uneven when zoomed out.
    const left = Math.round(x * scale + offsetX - sprite.width / 2);
    const top = Math.round(y * scale + offsetY - sprite.height / 2);
    Canvas.ctx.drawImage(sprite, (left - offsetX) / scale, (top - offsetY) / scale, sprite.width / scale, sprite.height / scale);
  }

  private sprite(scale: number): HTMLCanvasElement {
    let sprite = this.sprites.get(scale);
    if (sprite) return sprite;
    if (this.sprites.size >= MAX_CACHED_SPRITES) this.sprites.clear();

    sprite = document.createElement("canvas");
    sprite.width = sprite.height = Math.max(2, Math.ceil((this.radius + 1) * 2 * scale));
    this.paint(sprite.getContext("2d") as CanvasRenderingContext2D, sprite.width / 2, scale);
    this.sprites.set(scale, sprite);
    return sprite;
  }
}
