import {IDot} from "../../interfaces/dot.interface";
import {PlacedPart} from "../../interfaces/placed-part.interface";
import {SavedAdvancedComponent} from "../../project-file/project-file";
import {toGridPos} from "../../project-file/grid";
import {GridConfig} from "../../state/GridConfig";
import {AdvancedComponentDefinition, getAdvancedComponentDefinition, PIN_TILE_HALF, PinOffset} from "./advanced-component-definitions";
import {drawAdvancedComponentBody, getBoundingRect, PIN_PAD, Point} from "./advanced-component-render";
import {rotateOffset} from "./rotate-offset";

export class PlacedAdvancedComponent implements PlacedPart {
  public id: number = Math.random() * 100;
  public value?: string;
  public rotationAngle: 0 | 90 | 180 | 270 = 0;
  // Only meaningful for gridSizable definitions; 1x1 keeps every fixed-geometry part - and
  // every project saved before header pins existed - behaving exactly as before.
  public rows = 1;
  public cols = 1;

  constructor(
    public definitionId: string,
    public anchorDot: IDot,
    rotationAngle: 0 | 90 | 180 | 270 = 0
  ) {
    this.rotationAngle = rotationAngle;
  }

  get kind(): "advanced-component" { return "advanced-component"; }
  get layer(): "over-wires" { return "over-wires"; }

  // Rows/cols spanned by a two-click placement, from the two corner dots in either order.
  static gridSpanFromDots(a: IDot, b: IDot): {rows: number; cols: number} {
    return {
      cols: Math.round(Math.abs(b.x - a.x) / GridConfig.dotSpace) + 1,
      rows: Math.round(Math.abs(b.y - a.y) / GridConfig.dotSpace) + 1,
    };
  }

  getDefinition(): AdvancedComponentDefinition | undefined {
    return getAdvancedComponentDefinition(this.definitionId);
  }

  private toAbsolute(offsets: PinOffset[]): Point[] {
    return offsets.map(({dx, dy}) => {
      const rotated = rotateOffset(dx, dy, this.rotationAngle);
      return {
        x: this.anchorDot.x + rotated.x * GridConfig.dotSpace,
        y: this.anchorDot.y + rotated.y * GridConfig.dotSpace
      };
    });
  }

  private getPinOffsets(): PinOffset[] {
    const def = this.getDefinition();
    if (!def) return [];
    if (!def.gridSizable) return def.pinOffsets;
    const offsets: PinOffset[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        offsets.push({dx: col, dy: row});
      }
    }
    return offsets;
  }

  getPinPositions(): Point[] {
    return this.toAbsolute(this.getPinOffsets());
  }

  getShadedPositions(): Point[] {
    const def = this.getDefinition();
    if (!def?.shadedOffsets) return [];
    return this.toAbsolute(def.shadedOffsets);
  }

  getBodyOutline(): Point[] {
    const def = this.getDefinition();
    if (def?.gridSizable) {
      // The block's footprint is its pin lattice grown by half a tile on every side, so the
      // outline traces the outer edge of the drawn tiles rather than their pin centers.
      const left = -PIN_TILE_HALF;
      const top = -PIN_TILE_HALF;
      const right = this.cols - 1 + PIN_TILE_HALF;
      const bottom = this.rows - 1 + PIN_TILE_HALF;
      return this.toAbsolute([
        {dx: left, dy: top},
        {dx: right, dy: top},
        {dx: right, dy: bottom},
        {dx: left, dy: bottom},
      ]);
    }
    if (!def?.bodyOutline) return [];
    return this.toAbsolute(def.bodyOutline);
  }

  getIconAnchor(): Point {
    const def = this.getDefinition();
    if (def?.iconOffset) return this.toAbsolute([def.iconOffset])[0];
    const rect = getBoundingRect(this.getPinPositions());
    return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2};
  }

  rotate() {
    // A grid-sizable block is symmetric under rotation, so turning it about its anchor would
    // just make it jump off the holes the user spanned. Transpose it in place instead, which
    // keeps the top-left corner put and is what "rotate this header" actually means.
    if (this.getDefinition()?.gridSizable) {
      const rows = this.rows;
      this.rows = this.cols;
      this.cols = rows;
      return;
    }
    this.rotationAngle = ((this.rotationAngle + 90) % 360) as 0 | 90 | 180 | 270;
  }

  draw(selected: boolean) {
    const def = this.getDefinition();
    if (!def) return;
    drawAdvancedComponentBody(
      this.getPinPositions(), this.getShadedPositions(), this.getBodyOutline(), this.getIconAnchor(),
      def, this.rotationAngle, {selected}
    );
  }

  // Pin and shaded-hole positions already account for rotation and rows/cols.
  getOccupiedPositions(): Point[] {
    return [...this.getPinPositions(), ...this.getShadedPositions()];
  }

  getAnchorDots(): IDot[] {
    return [this.anchorDot];
  }

  setAnchorDots(dots: IDot[]) {
    if (dots[0]) this.anchorDot = dots[0];
  }

  serialize(): SavedAdvancedComponent {
    return {
      definitionId: this.definitionId,
      at: toGridPos(this.anchorDot),
      rotation: this.rotationAngle,
      rows: this.rows,
      cols: this.cols,
      ...(this.value ? {value: this.value} : {}),
    };
  }

  // Axis-aligned box around the visible body - the outline if the definition has one,
  // otherwise the pins padded out the same way the renderer draws the default body box.
  getBodyRect(): {x: number; y: number; w: number; h: number} {
    const outline = this.getBodyOutline();
    return outline.length >= 3
      ? getBoundingRect(outline)
      : getBoundingRect([...this.getPinPositions(), ...this.getShadedPositions()], PIN_PAD);
  }

  containsPoint(x: number, y: number): boolean {
    const rect = this.getBodyRect();
    return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
